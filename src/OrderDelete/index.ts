import AWS from "aws-sdk"
import {APIGatewayProxyEvent,APIGatewayProxyResult,APIGatewayProxyHandler} from "aws-lambda"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const ORDER_TABLE = process.env.ORDER_TABLE
const listAuthorizers = ["admin","user"]

export const handler :APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        await main(ev)
        return{
            statusCode:200,
            body: JSON.stringify({message:"Delete successfully"})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<void> => {
    await checkRole(ev)
    await checkExistOrder(ev)
    await deleteOrder(ev)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if(!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const checkExistOrder = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const order = await dynamoDB.get({
        TableName:ORDER_TABLE,
        Key: {id:ev.pathParameters.id || ""}
    }).promise()
    if(!order.Item){
        throw{
            code: "ItemNotFound"
        }
    }
    if(order.Item.user !== ev.requestContext.authorizer.claims.email){
        throw{
            code:"NotOwner"
        }
    }
}

const deleteOrder = async (ev:APIGatewayProxyEvent):Promise<void> => {
    await dynamoDB.delete({
        TableName:ORDER_TABLE,
        Key:{id:ev.pathParameters.id || ""}
    }).promise()
}



const handlerError = (err:any):APIGatewayProxyResult=>{
    if(err.code === "NotAuthorize"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if(err.code === "ItemNotFound"){
        return{
            statusCode:404,
            body:JSON.stringify({message:"Order not found"})
        }
    }
    if(err.code === "NotOwner"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"Order only can be deleted by owner"})
        }
    }
    console.log(err)
    return{
        statusCode:500,
        body:JSON.stringify({message:"Something went wrong"})
    }
}