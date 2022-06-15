import AWS , {S3} from "aws-sdk"
import { APIGatewayProxyEvent,APIGatewayProxyResult, APIGatewayProxyHandler } from "aws-lambda"
import joi, { ValidationError } from "joi"
import {v4 as uuidv4} from "uuid"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const PRODUCT_TABLE = process.env.PRODUCT_TABLE
const CATEGORY_TABLE = process.env.CATEGORY_TABLE
const s3 = new S3({signatureVersion: "v4"})
const S3_BUCKET = process.env.S3_BUCKET || ""
const listAuthorizers = ["admin"]

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try {
        const result = await main(ev)
        return {
            statusCode: 200,
            body: JSON.stringify({product:result})
        }

    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent) : Promise<object> => {
    await checkRole(ev)
    const value = await checkValidation(ev)
    await checkExistCategory(value)
    await updateCategory(value)
    return await postProduct(value)
}

const checkRole = async (ev:APIGatewayProxyEvent) : Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if (!listAuthorizers.includes(role)){
        throw{
            code: "NotAuthorize"
        }
    }
}

const checkValidation = async (ev:APIGatewayProxyEvent) : Promise<object> => {
    const body = JSON.parse(ev.body)
    const productSchema = joi.object({
        name: joi.string().trim().required(),
        unitPrice: joi.number().required(),
        category: joi.string().required(),
        remainAmount: joi.number().integer().min(0).required()
    })
    return await productSchema.validateAsync(body,{abortEarly:false})
}

const checkExistCategory = async (value:any) : Promise<void> => {
    const existedCategory = await dynamoDB.get({
        TableName: CATEGORY_TABLE,
        Key: {id:value.category || ""}
    }).promise()
    if(!existedCategory.Item){
        throw{
            code: "ItemNotFound"
        }
    }
}

const updateCategory = async (value:any) : Promise<void> => {
    await dynamoDB.update({
        TableName: CATEGORY_TABLE,
        Key: { id: value.category},
        UpdateExpression: " ADD listProducts :product",
        ExpressionAttributeValues: {":product" : dynamoDB.createSet([value.name])}
    }).promise()
}

const postProduct = async (value:any):Promise<object> => {
    const now = new Date()
    value.createdAt = now.getTime()
    value.updatedAt = now.getTime()
    value.image = ""
    value.thumbnail = ""
    value.id = uuidv4()
    await dynamoDB.put({
        TableName: PRODUCT_TABLE,
        Item:value
    }).promise()
    return value
}

const handlerError = (err:any) : APIGatewayProxyResult => {
    if(err.code === "NotAuthorize"){
        return{
            statusCode: 401,
            body: JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if(err.code === "ItemNotFound"){
        return{
            statusCode: 404,
            body:JSON.stringify({message:"Category not found"})
        }
    }
    if(err instanceof ValidationError) {
        return{
            statusCode:400,
            body: JSON.stringify({error:err})
        }
    }
    console.log(err)
    return{
        statusCode: 500,
        body: JSON.stringify({message: "Something went wrong"})
    }
}