import AWS, {S3} from "aws-sdk"
import { APIGatewayProxyEvent,APIGatewayProxyHandler, APIGatewayProxyHandlerV2, APIGatewayProxyResult } from "aws-lambda"

const s3 = new S3({signatureVersion:"v4"})
const S3_BUCKET = process.env.S3_BUCKET
const PRODUCT_TABLE = process.env.PRODUCT_TABLE
const dynamoDB = new AWS.DynamoDB.DocumentClient()
const listAuthorizers = ["admin","user"]

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        const result = await main(ev)
        return {
            statusCode:200,
            body: JSON.stringify({result})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<object> => {
    await checkRole(ev)
    const productArray = await getProductArray(ev)
    return await returnProductArray(productArray)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> =>{
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if(!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const getProductArray = async (ev:APIGatewayProxyEvent):Promise<AWS.DynamoDB.DocumentClient.ItemList> => {
    let productArray = []
    const scanParams = {
        TableName: PRODUCT_TABLE
    }
    let result = await dynamoDB.scan(scanParams).promise()
    productArray = productArray.concat(result.Items)
    while (result.LastEvaluatedKey){
        result = await dynamoDB.scan(scanParams).promise()
        productArray = productArray.concat(result.Items)
    }
    return productArray
}

const returnProductArray = async (productArray:AWS.DynamoDB.DocumentClient.ItemList):Promise<AWS.DynamoDB.DocumentClient.ItemList> => {
    return Promise.all(
        productArray.map(async (product) => {
            const result = product
            delete result.image
            if(result.thumbnail !== ""){
                result.thumbnail  = await getSignUrlThumbnail(product.thumbnail)
            }
            return result
        })
    )
}

const getSignUrlThumbnail = async (thumbnailPath:string):Promise<string> => {
    return s3.getSignedUrl("getObject",{
        Bucket: S3_BUCKET,
        Key: thumbnailPath
    })
}

const handlerError = (err:any) : APIGatewayProxyResult => {
    if(err.code === "NotAuthorize"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    console.log(err)
    return{
        statusCode:500,
        body:JSON.stringify({message:"Something went wrong"})
    }
}