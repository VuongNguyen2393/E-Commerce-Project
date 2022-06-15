import AWS, { APIGateway } from "aws-sdk"
import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyHandlerV2, APIGatewayProxyResult } from "aws-lambda"

const dynamoDB = new AWS.DynamoDB.DocumentClient()
const ORDER_TABLE = process.env.ORDER_TABLE
const listAuthorizers = ["admin",'user']

export const handler :APIGatewayProxyHandler = async (ev: APIGatewayProxyEvent) => {
    try{
        const result = await main(ev)
        return {
            statusCode: 200,
            body: JSON.stringify({result})
        }
    }catch(err){
        return handlerError(ev)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<AWS.DynamoDB.DocumentClient.AttributeMap>=> {
    await checkRole(ev)
    return await listOrderByUser(ev)
}

const checkRole = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const role = ev.requestContext.authorizer.claims["custom:role"] || ""
    if (!listAuthorizers.includes(role)){
        throw{
            code:"NotAuthorize"
        }
    }
}

const listOrderByUser = async (ev:APIGatewayProxyEvent) : Promise<AWS.DynamoDB.DocumentClient.AttributeMap> => {
    const result =  await dynamoDB.scan({
        TableName:ORDER_TABLE,
        ProjectionExpression:"id,createdAt,updatedAt",
        FilterExpression: '#user = :email',
        ExpressionAttributeNames: {'#user': 'user'},
        ExpressionAttributeValues: {":email": ev.requestContext.authorizer.claims.email}
    }).promise()
    return result.Items
}

const handlerError = (err:any):APIGatewayProxyResult => {
    if(err.code==="NotAuthorize"){
        return{
            statusCode:401,
            body:JSON.stringify({message:"Something went wrong"})
        }
    }
    console.log(err)
    return {
        statusCode:500,
        body:JSON.stringify({message:"Something went wrong"})
    }
}