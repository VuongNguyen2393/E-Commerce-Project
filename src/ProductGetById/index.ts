import AWS, {S3} from "aws-sdk"
import {APIGatewayProxyHandler, APIGatewayProxyEvent,APIGatewayProxyResult, APIGatewayProxyHandlerV2} from "aws-lambda"

const dynamoDB  = new AWS.DynamoDB.DocumentClient()
const PRODUCT_TABLE = process.env.PRODUCT_TABLE
const s3 = new S3({signatureVersion:"v4"})
const S3_BUCKET = process.env.S3_BUCKET
const listAuthorizers = ["admin","user"]

export const handler : APIGatewayProxyHandler= async (ev: APIGatewayProxyEvent) => {
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

const main = async (ev: APIGatewayProxyEvent) : Promise<object> => {
    await checkRole(ev)
    const product = await checkAndGetProduct(ev)
    return await returnProduct(product)
}

const checkRole = async (ev:APIGatewayProxyEvent) : Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if(!listAuthorizers.includes(role)){
        throw{
            code : "NotAuthorize"
        }
    }
}

const checkAndGetProduct = async (ev:APIGatewayProxyEvent):Promise<object> => {
    const product = await dynamoDB.get({
        TableName:PRODUCT_TABLE,
        Key: {id: ev.pathParameters.id || ""}
    }).promise()
    if(!product.Item){
        throw{
            code:"ItemNotFound"
        }
    }
    return product.Item
}

const returnProduct = async (product:any):Promise<object> => {
    if(product.image !== ""){
        product.image = await getSignUrlImage(product.image)
    }
    delete product.thumbnail
    return product
}

const getSignUrlImage = async (imagePath:string):Promise<string>=>{
    return  s3.getSignedUrl("getObject",{
        Bucket: S3_BUCKET,
        Key:imagePath
    })
}

const handlerError = (err:any) : APIGatewayProxyResult => {
    if(err.code==="NotAuthorize"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if (err.code ==="ItemNotFound"){
        return {
            statusCode:404,
            body:JSON.stringify({message:"Product Not Found"})
        }
    }
    console.log(err)
    return {
        statusCode: 500,
        body: JSON.stringify({message: "Something went wrong"})
    }
}