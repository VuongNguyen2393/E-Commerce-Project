import AWS from "aws-sdk"
import {APIGatewayProxyHandler,APIGatewayProxyEvent,APIGatewayProxyResult} from "aws-lambda"
import joi,{ValidationError} from "joi"
import {v4 as uuidv4} from "uuid"


const dynamoDB = new AWS.DynamoDB.DocumentClient()
const CATEGORY_TABLE = process.env.CATEGORY_TABLE || "";
const listAuthorizers = ["admin"];

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try {
        const result = await main(ev)
        return {
            statusCode : 200,
            body : JSON.stringify({result})
        }
    }catch (err){
        return handlerError (err) 
    }
}

const main  = async (ev:APIGatewayProxyEvent): Promise<object> => {
    await checkRole(ev)
    const value = await checkValidation(ev)
    await checkExistCategory(value)
    return await postCategory(value)
}

const checkRole = async (ev: APIGatewayProxyEvent): Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || "";
    if (!listAuthorizers.includes(role)) {
      throw {
        code: "NotAuthorize",
      };
    }
  };

const checkValidation = async (ev:APIGatewayProxyEvent) : Promise<object> => {
    const body = JSON.parse(ev.body || "{}")
    const categorySchema = joi.object({
        name: joi.string().trim().required()
    })
    return await categorySchema.validateAsync(body,{abortEarly:false})
}

const checkExistCategory = async (value:any) : Promise<void> => {
    const category = await dynamoDB.scan({
        TableName: CATEGORY_TABLE,
        FilterExpression:'#name = :name',
        ExpressionAttributeNames: {'#name':'name'},
        ExpressionAttributeValues: {':name': value.name}
    }).promise()
    if(category.Items.length !== 0){
        throw{
            code: "ItemExist"
        }
    }
}

const postCategory = async (value:any) : Promise<object> => {
    const now = new Date()
    value.createdAt = now.getTime()
    value.updatedAt = now.getTime()
    value.id = uuidv4()
    await dynamoDB.put({
        TableName: CATEGORY_TABLE,
        Item: value
    }).promise()
    return value
}



const handlerError  = (err:any) : APIGatewayProxyResult => {
    if (err instanceof ValidationError){
        return {
            statusCode:400,
            body: JSON.stringify({error:err})
        }
    }
    if (err.code === "NotAuthorize"){
        return {
            statusCode:401,
            body: JSON.stringify({Message:"You don't have permission to use this function"})
        }
    }
    if (err.code === "ItemExist"){
        return {
            statusCode:406,
            body: JSON.stringify({Message:"Category Exist!!!"})
        }
    }
    console.log(err)
    return {
        statusCode: 500,
        body:JSON.stringify({message:"Something went wrong"})
    }
}