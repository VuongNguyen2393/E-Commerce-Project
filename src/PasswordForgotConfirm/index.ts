import {APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult} from "aws-lambda"
import {CognitoIdentityServiceProvider} from "aws-sdk"
import joi, {ValidationError} from "joi"

const CLIENT_ID = process.env.CLIENT_ID
const cognito = new CognitoIdentityServiceProvider()

export const handler : APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        await main(ev)
        return{
            statusCode:200,
            body:JSON.stringify("Confirm successfully")
        }
    }catch(err:any){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const value = await checkValidation(ev)
    await confirmForgotPassword(value)
}

const checkValidation = async (ev:APIGatewayProxyEvent):Promise<void> => {
    const body = JSON.parse(ev.body || "")
    const confirmSchema = joi.object({
        email: joi.string().trim().required(),
        newPassword: joi.string().trim().regex(/^(?=.*?[a-z])(?=.*?[A-Z])(?=.*?[0-9])[a-zA-Z\d@$!%*#?&]+/).required(),
        confirmationCode: joi.string().required()
    })
    return await confirmSchema.validateAsync(body,{abortEarly:false})
}

const confirmForgotPassword = async (value:any) : Promise<void> => {
    await cognito.confirmForgotPassword({
        ClientId: CLIENT_ID,
        Username: value.email,
        Password: value.newPassword,
        ConfirmationCode: value.confirmationCode
    }).promise()
}


const handlerError = (err:any):APIGatewayProxyResult => {
    if(err instanceof ValidationError){
        return{
            statusCode:400,
            body: JSON.stringify({error:err})
        }
    }
    if(err.code === "UserNotFoundException"){
        return{
            statusCode:404,
            body: JSON.stringify({message: "User not found"})
        }
    }
    if(err.code === "InvalidPasswordException"){
        return{
            statusCode:400,
            body: JSON.stringify({message:"Password is invalid"})
        }
    }
    if(err.code === "CodeMismatchException"){
        return{
            statusCode:400,
            body: JSON.stringify({message:"confirmationCode is mismatch"})
        }
    }
    if(err.code === "ExpiredCodeException"){
        return{
            statusCode: 400,
            body:JSON.stringify({message:"The code has expired"})
        }
    }
    console.log(err)
    return{
        statusCode:500,
        body: JSON.stringify({message:"Something went wrong"})
    }
}