import AWS from "aws-sdk"
import { APIGatewayProxyEvent, APIGatewayProxyResult,APIGatewayProxyHandler } from "aws-lambda"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const CATEGORY_TABLE = process.env.CATEGORY_TABLE
const listAuthorizers = ["admin","user"]

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try {
        const result = await main(ev)
        return {
            statusCode : 200,
            body : JSON.stringify(result)
        }
    } catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<object> => {
    await checkRole(ev)
    return await checkAndGetCategory(ev)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if (!listAuthorizers.includes(role)){
        throw{
            code: "NotAuthorize"
        }
    }
}

const checkAndGetCategory = async (ev:APIGatewayProxyEvent):Promise<object> => {
    const category = await dynamoDB.get({
        TableName: CATEGORY_TABLE,
        Key: {id : ev.pathParameters.id || ""}
    }).promise()
    if (!category.Item){
        throw {
            code: "ItemNotFound"
        }
    }
    return category.Item
}

const handlerError = (err:any): APIGatewayProxyResult => {
    if (err.code === "NotAuthorize"){
        return{
            statusCode: 401,
            body: JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if (err.code === "ItemNotFound"){
        return {
            statusCode: 404,
            body: JSON.stringify({message: "Category not found"})
        }
    }
    console.log(err)
    return {
        statusCode: 500,
        body: JSON.stringify({message:"Something went wrong"})
    }
}