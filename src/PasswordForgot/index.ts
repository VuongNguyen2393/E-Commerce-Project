import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import {CognitoIdentityServiceProvider} from "aws-sdk"
import joi, {ValidationError} from "joi"


const CLIENT_ID = process.env.CLIENT_ID || ""
const cognito = new CognitoIdentityServiceProvider()

export const handler: APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        await main(ev)
        return{
            statusCode: 200,
            body:JSON.stringify({message: "Request reset password send successfully"})
        }
    }catch(err:any){
        return handlerError(err)
    }
}

const main = async (ev: APIGatewayProxyEvent):Promise<void> => {
    const value = await checkValidation(ev)
    await processForgotPassword(value)
}

const checkValidation = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const body = JSON.parse(ev.body || "")
    const requestSchema = joi.object({
        email: joi.string().trim().required()
    })
    return await requestSchema.validateAsync(body,{abortEarly:false})
}

const processForgotPassword = async (value:any) : Promise<void> => {
    await cognito.forgotPassword({
        ClientId: CLIENT_ID,
        Username: value.email
    }).promise()
}

const handlerError = (err:any) : APIGatewayProxyResult => {
    if(err instanceof ValidationError){
        return {
            statusCode: 400,
            body: JSON.stringify({error:err})
        }
    }
    if(err.code === "UserNotFoundException"){
        return{
            statusCode:404,
            body: JSON.stringify({message: "User not found"})
        }
    }
    if(err.code === "TooManyRequestsException"){
        return{
            statusCode: 400,
            body:JSON.stringify({message:"you made too much requests. Please wait"})
        }
    }
    if(err.code === "LimitExceededException"){
        return{
            statusCode: 400,
            body:JSON.stringify({message:"You reached the limit request of today"})
        }
    }
    console.log(err)
    return{
        statusCode: 500,
        body: JSON.stringify({message:"Something went wrong"})
    }
}