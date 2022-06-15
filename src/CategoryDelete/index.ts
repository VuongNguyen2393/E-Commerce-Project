import AWS from "aws-sdk"
import {APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult} from "aws-lambda"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const CATEGORY_TABLE = process.env.CATEGORY_TABLE || "";
const listAuthorizers = ["admin"];

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try {
        await main(ev)
        return {
            statusCode: 200,
            body: JSON.stringify({message:"Delete successfully"})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<void> => {
    await checkRole(ev)
    await checkExist(ev)
    await deleteCategory(ev)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if (! listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const checkExist = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const existedCategory = await dynamoDB.get({
        TableName:CATEGORY_TABLE,
        Key: {id:ev.pathParameters.id || ""}
    }).promise()
    if(!existedCategory.Item){
        throw{
            code:"ItemNotFound"
        }
    }
}

const deleteCategory = async (ev:APIGatewayProxyEvent):Promise<void> => {
    await dynamoDB.delete({
        TableName: CATEGORY_TABLE,
        Key: {id:ev.pathParameters.id || ""}
    }).promise()
}

const handlerError = (err:any):APIGatewayProxyResult => {
    if(err.code === "NotAuthorize"){
        return {
            statusCode: 401,
            body: JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if(err.code === "ItemNotFound"){
        return{
            statusCode:404,
            body: JSON.stringify({message:"Category not found"})
        }
    }
    console.log(err)
    return {
        statusCode: 500,
        body: JSON.stringify({message:"Something went wrong"})
    }
}