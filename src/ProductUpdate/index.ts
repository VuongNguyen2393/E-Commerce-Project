import AWS,{S3} from "aws-sdk"
import {APIGatewayProxyEvent,APIGatewayProxyHandler,APIGatewayProxyResult} from "aws-lambda"
import joi,{any, ValidationError} from "joi"
import { mainModule } from "process"
import { checkServerIdentity } from "tls"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const PRODUCT_TABLE = process.env.PRODUCT_TABLE
const CATEGORY_TABLE = process.env.CATEGORY_TABLE
const listAuthorizers = ["admin"]

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        const result = await main(ev)
        return {
            statusCode: 200,
            body: JSON.stringify({result})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent) : Promise<object> => {
    await checkRole(ev)
    const value = await checkValidation(ev)
    const existedProduct = await checkExistProduct(ev)
    await checkExistCategory(value)
    await updateCategory(value,existedProduct)
    return await updateProduct(value,existedProduct)
}

const checkRole = async (ev:APIGatewayProxyEvent) : Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if (!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const checkValidation = async (ev:APIGatewayProxyEvent) : Promise<object> => {
    const body = JSON.parse(ev.body || "{}")
    const productSchema = joi.object({
        name:joi.string().trim(),
        unitPrice:joi.number(),
        category:joi.string().trim(),
        remainAmount: joi.number().integer().min(0)
    })
    return await productSchema.validateAsync(body,{abortEarly:false})
}

const checkExistProduct = async (ev:APIGatewayProxyEvent):Promise<object> => {
    const existedProduct = await dynamoDB.get({
        TableName:PRODUCT_TABLE,
        Key:{id:ev.pathParameters.id || ""}
    }).promise()
    if(!existedProduct.Item){
        throw{
            code:"ProductNotFound"
        }
    }
    return existedProduct.Item
}

const checkExistCategory = async (value:any):Promise<void> => {
    if(value.category){
        const existedCategory = await dynamoDB.get({
            TableName:CATEGORY_TABLE,
            Key:{id:value.category||""}
        }).promise()
        if(!existedCategory.Item){
            throw{
                code: "CategoryNotFound"
            }
        }
    }
}

const updateCategory = async (value:any, existedProduct:any):Promise<void> =>{
    if(value.category && value.name){
        await dynamoDB.update({
            TableName:CATEGORY_TABLE,
            Key: {id: existedProduct.category},
            UpdateExpression: 'DELETE listProducts :product ',
            ExpressionAttributeValues: {':product': dynamoDB.createSet([existedProduct.name])},
        }).promise()
        await dynamoDB.update({
            TableName: CATEGORY_TABLE,
            Key: {id: value.category},
            UpdateExpression: " ADD listProducts :product",
            ExpressionAttributeValues: {":product" : dynamoDB.createSet([value.name])}
        }).promise()
    }
    if(value.category && !value.name){
        await dynamoDB.update({
            TableName:CATEGORY_TABLE,
            Key: {id: existedProduct.category},
            UpdateExpression: 'DELETE listProducts :product ',
            ExpressionAttributeValues: {':product': dynamoDB.createSet([existedProduct.name])},
        }).promise()
        await dynamoDB.update({
            TableName: CATEGORY_TABLE,
            Key: {id: value.category},
            UpdateExpression: " ADD listProducts :product",
            ExpressionAttributeValues: {":product" : dynamoDB.createSet([existedProduct.name])}
        }).promise()
    }
}

const updateProduct = async (value:any,existedProduct:any) : Promise<object> => {
    const now = new Date()
    value.updatedAt = now.getTime()
    const updatedProduct = {...existedProduct,...value}
    await dynamoDB.put({
        TableName: PRODUCT_TABLE,
        Item:updatedProduct
    }).promise()
    return updatedProduct
}

const handlerError = (err:any) : APIGatewayProxyResult => {
    if(err.code === "NotAuthorize"){
        return{
            statusCode : 401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if(err.code === "ProductNotFound"){
        return{
            statusCode:404,
            body:JSON.stringify({message:"Product Not Found"})
        }
    }
    if(err.code === "CategoryNotFound"){
        return{
            statusCode:404,
            body:JSON.stringify({message:"Category Not Found"})
        }
    }
    console.log(err)
    return{
        statusCode: 500,
        body: JSON.stringify({message:"Something went wrong"})
    }
}