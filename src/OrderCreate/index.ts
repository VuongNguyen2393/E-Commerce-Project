import AWS,{S3} from "aws-sdk"
import {APIGatewayProxyHandler,APIGatewayProxyEvent,APIGatewayProxyResult, APIGatewayProxyHandlerV2} from "aws-lambda"
import joi,{ValidationError} from "joi"
import {v4 as uuidv4} from "uuid"
import { float } from "aws-sdk/clients/lightsail"
import { json } from "stream/consumers"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const ORDER_TABLE = process.env.ORDER_TABLE
const PRODUCT_TABLE = process.env.PRODUCT_TABLE
const listAuthorizers = ["admin","user"]

export const handler :APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent)=> {
    try{
        const result = await main(ev)
        return {
            statusCode:200,
            body:JSON.stringify({order:result})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<object> => {
    await checkRole(ev)
    const value = await checkValidation(ev)
    await checkExistProducts(value)
    await checkAmountProducts(value)
    return await postOrder(value,ev)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if(!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const checkValidation = async (ev:APIGatewayProxyEvent):Promise<AWS.DynamoDB.DocumentClient.ItemList> => {
    const orderList : AWS.DynamoDB.DocumentClient.ItemList = JSON.parse(ev.body || "[]") 
    const orderSchema = joi.object({
        product:joi.string().required(),
        amount: joi.number().default(1).required()
    })
    return Promise.all(
        orderList.map(async (item) => {
            return await orderSchema.validateAsync(item,{abortEarly:false})
        })
    )
}

const checkExistProducts = async (value:any):Promise<void> => {
    await Promise.all(
        value.map(async (item:any)=> {
            const product = await dynamoDB.get({
                TableName: PRODUCT_TABLE,
                Key: {id:item.product || ""}
            }).promise()
            if(!product.Item){
                throw{
                    code:"ItemNotFound"
                }
            }
        })
    )
}

const checkAmountProducts = async (value:any):Promise<void> => {
    await Promise.all(
        value.map(async (item:any) => {
            const product = await dynamoDB.get({
                TableName: PRODUCT_TABLE,
                Key: {id: item.product || ""}
            }).promise()
            const remain = product.Item.remainAmount - item.amount
            if(remain < 0){
                throw{
                    code: "OverAmount",
                    product: product.Item.name,
                    remain: product.Item.remainAmount
                }
            }
            await dynamoDB.update({
                TableName: PRODUCT_TABLE,
                Key: {id: item.product},
                UpdateExpression: "set remainAmount = :remain",
                ExpressionAttributeValues: {":remain" : remain}
            }).promise()
        })
    )
}

const postOrder = async (value:any,ev:APIGatewayProxyEvent):Promise<AWS.DynamoDB.DocumentClient.AttributeMap> => {
    const result = JSON.parse("{}")
    const now = new Date()
    result.detail = value
    result.id = uuidv4()
    result.createdAt = now.getTime()
    result.totalPrice = await sumPrice(value)
    result.user = ev.requestContext.authorizer.claims.email
    await dynamoDB.put({
        TableName:ORDER_TABLE,
        Item: result
    }).promise()
    return result
}

const sumPrice = async (value:any):Promise<float> => {
    let totalPrice = 0
    for (let i = 0; i < value.length; i++){
        const amount = value[i].amount
        const product = await dynamoDB.get({
            TableName:PRODUCT_TABLE,
            Key:{id:value[i].product}
        }).promise()
        totalPrice = totalPrice + amount*product.Item.unitPrice
    }
    return totalPrice
}


const handlerError = (err:any) : APIGatewayProxyResult => {
    if(err.code === "OverAmount"){
        return {
            statusCode:404,
            body:JSON.stringify({message:`${err.product} only remains ${err.remain}`})
        }
    }
    if(err.code === "NotAuthorize"){
        return {
            statusCode:401,
            body:JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    if(err instanceof ValidationError){
        return{
            statusCode:400,
            body:JSON.stringify({error:err})
        }
    }
    if(err.code === "ItemNotFound"){
        return{
            statusCode:404,
            body:JSON.stringify({message:"Product Not Found"})
        }
    }
    console.log(err)
    return{
        statusCode:500,
        body:JSON.stringify({message:"Something went wrong"})
    }
}