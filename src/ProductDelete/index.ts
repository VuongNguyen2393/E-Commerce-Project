import AWS from "aws-sdk"
import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const PRODUCT_TABLE = process.env.PRODUCT_TABLE
const listAuthorizers = ["admin"]

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent)=>{
    try{
        await main(ev)
        return {
            statusCode:200,
            body:JSON.stringify({message:"Delete Successfully"})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<void> => {
    await checkRole(ev)
    await checkExistProduct(ev)
    await deleteProduct(ev)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if(!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const checkExistProduct = async (ev:APIGatewayProxyEvent):Promise<void>=> {
    const product = await dynamoDB.get({
        TableName:PRODUCT_TABLE,
        Key:{id:ev.pathParameters.id || ""}
    }).promise()
    if(!product.Item){
        throw{
            code:"ItemNotFound"
        }
    }
}

const deleteProduct = async (ev:APIGatewayProxyEvent):Promise<void> => {
    await dynamoDB.delete({
        TableName:PRODUCT_TABLE,
        Key:{id: ev.pathParameters.id || ""}
    }).promise()
}

const handlerError = (err:any) : APIGatewayProxyResult => {
    if(err.code === "NotAuthorize"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if (err.code === "ItemNotFound"){
        return{
            statusCode:404,
            body:JSON.stringify({message:"Product not found"})
        }
    }
    console.log(err)
    return{
        statusCode:500,
        body:JSON.stringify({message:"Something went wrong"})
    }
}