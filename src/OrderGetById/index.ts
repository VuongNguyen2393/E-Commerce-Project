import AWS, { APIGateway } from "aws-sdk"
import {APIGatewayProxyHandler,APIGatewayProxyResult,APIGatewayProxyEvent, APIGatewayProxyHandlerV2, APIGatewayProxyEventV2} from "aws-lambda"

const dynamoDB = new AWS.DynamoDB.DocumentClient
const ORDER_TABLE = process.env.ORDER_TABLE
const listAuthorizers = ["admin","user"]

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        const result = await main(ev)
        return{
            statusCode:200,
            body: JSON.stringify({result})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<object> => {
    await checkRole(ev)
    return await checkAndGetOrder(ev)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if(!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}


const checkAndGetOrder = async (ev:APIGatewayProxyEvent):Promise<object> => {
    const order = await dynamoDB.get({
        TableName:ORDER_TABLE,
        Key:{id:ev.pathParameters.id || ""}
    }).promise()
    if(!order.Item){
        throw{
            code:"ItemNotExist"
        }
    }
    if(order.Item.user !== ev.requestContext.authorizer.claims.email){
        throw{
            code:"NotOwnerOrder"
        }
    }
    return order.Item
}


const handlerError = (err:any):APIGatewayProxyResult => {
    if(err.code === "NotAuthorize"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if(err.code === "ItemNotExist"){
        return {
            statusCode: 404,
            body: JSON.stringify({message:"Order not found"})
        }
    }
    if(err.code === "NotOwnerOrder"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to access this order"})
        }
    }
    console.log(err)
    return{
        statusCode:500,
        body:JSON.stringify({message:"Something went wrong"})
    }
}