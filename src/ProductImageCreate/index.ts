import AWS ,{S3} from "aws-sdk"
import { APIGatewayProxyEvent,APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda"
import joi ,{ValidationError}from "joi"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const s3 = new S3({signatureVersion:"v4"})
const S3_BUCKET = process.env.S3_BUCKET
const PRODUCT_TABLE = process.env.PRODUCT_TABLE
const listAuthorizers = ["admin"]


export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        const result = await main(ev)
        return{
            statusCode:200,
            body: JSON.stringify(result)
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<string> => {
    await checkRole(ev)
    const product = await checkAndGetProduct(ev)
    const value = await checkValidation(ev)
    const {url,filePath} = await getSignedUrl(value,ev)
    await updateProductImage(product,filePath)
    return url
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if(!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const checkAndGetProduct = async (ev:APIGatewayProxyEvent):Promise<object> => {
    const product = await dynamoDB.get({
        TableName:PRODUCT_TABLE,
        Key:{id:ev.pathParameters.id || ""}
    }).promise()
    if(!product.Item){
        throw{
            code:"ItemNotFound"
        }
    }
    return product
}

const checkValidation = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const body = JSON.parse(ev.body || "{}")
    const fileTypeSchema = joi.object({
        fileType: joi.string().valid("jpeg","jpg","png").required()
    })
    return await fileTypeSchema.validateAsync(body,{abortEarly:false})
}

const getSignedUrl = async (value:any,ev:APIGatewayProxyEvent) => {
    const fileName = ev.pathParameters.id
    const filePath = "image/" + fileName + "." +value.fileType
    return {
        url: s3.getSignedUrl("putObject",{
            Bucket: S3_BUCKET,
            Key: filePath
        }),
        filePath
    }
}

const updateProductImage = async (product:any,filePath:string,):Promise<void> => {
    await dynamoDB.update({
        TableName:PRODUCT_TABLE,
        Key: {id:product.Item.id},
        UpdateExpression: "set image = :img, updatedAt = :updatedAt",
        ExpressionAttributeValues:{
            ":img" : filePath,
            ":updatedAt": new Date().getTime()
        }
    }).promise()
}

const handlerError = (err:any):APIGatewayProxyResult => {
    if(err instanceof ValidationError){
        return{
            statusCode:400,
            body:JSON.stringify({error:err})
        }
    }
    if(err.code === "NotAuthorize"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if(err.code === "ItemNotFound"){
        return{
            statusCode:404,
            body:JSON.stringify({message:"Product not found"})
        }
    }
    console.log(err)
    return{
        statusCode: 500,
        body: JSON.stringify({message:"Something went wrong"})
    }
}