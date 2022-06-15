import AWS from "aws-sdk"
import {APIGatewayProxyHandler,APIGatewayProxyEvent,APIGatewayProxyResult} from "aws-lambda"
import joi,{ValidationError} from "joi"


const dynamoDB = new AWS.DynamoDB.DocumentClient()
const CATEGORY_TABLE = process.env.CATEGORY_TABLE
const listAuthorizers = ["admin"];

export const handler : APIGatewayProxyHandler = async (ev: APIGatewayProxyEvent) => {
    try{
        await main(ev)
        return {
            statusCode: 200,
            body: JSON.stringify({message:"Update successfully"})
        }
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev : APIGatewayProxyEvent) : Promise<void> => {
    await checkRole(ev)
    const value = await checkValidation(ev)
    const existedCategory = await checkExistCategory(value,ev)
    await updateCategory(value,existedCategory)
}

const checkRole = async (ev: any): Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || "";
    if (!listAuthorizers.includes(role)) {
      throw {
        code: "NotAuthorize",
      };
    }
};

const checkValidation = async (ev:APIGatewayProxyEvent):Promise<object> => {
    const body = JSON.parse(ev.body || "{}")
    const categorySchema = joi.object({
        name: joi.string().trim()
    })
    return await categorySchema.validateAsync(body,{abortEarly:false})
}

const checkExistCategory = async (value:any,ev:APIGatewayProxyEvent) : Promise<object> => {
    const existedCategory = await dynamoDB.get({
        TableName: CATEGORY_TABLE,
        Key: {id:ev.pathParameters.id}
    }).promise()
    if (!existedCategory.Item){
        throw {
            code:"ItemNotFound"
        }
    }
    return existedCategory.Item
}

const updateCategory = async (value :any,existedCategory:any) : Promise<void> => {
    const now = new Date()
    value.updatedAt = now.getTime()
    const updatedCategory = {...existedCategory,...value}
    await dynamoDB.put({
        TableName: CATEGORY_TABLE,
        Item: updatedCategory
    }).promise()
}

const handlerError = (err:any) : APIGatewayProxyResult => {
    if( err instanceof ValidationError){
        return {
            statusCode:400,
            body: JSON.stringify({error:err})
        }
    }
    if(err.code === "ItemNotFound"){
        return{
            statusCode:404,
            body: JSON.stringify({message:"Category not found"})
        }
    }
    if(err.code === "NotAuthorize"){
        return{
            statusCode: 401,
            body: JSON.stringify({message:"You don't have permission to use this function"})
        }
    }
    console.log(err)
    return {
        statusCode: 500,
        body: JSON.stringify({message:"Something went wrong"})
    }
}
