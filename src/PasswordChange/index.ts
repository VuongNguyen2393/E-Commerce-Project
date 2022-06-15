import {APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler} from 'aws-lambda'
import {CognitoIdentityServiceProvider} from "aws-sdk"
import joi, {ValidationError} from "joi"

const CLIENT_ID = process.env.CLIENT_ID || ""
const cognito = new CognitoIdentityServiceProvider()

export const handler: APIGatewayProxyHandler = async (ev:APIGatewayProxyEvent) => {
    try{
        await main(ev)
        return{
            statusCode: 200,
            body:JSON.stringify({message: "Change Password Successfully"})
        }
    } catch(err:any){
        return handlerError(err)
    }
}

const main = async (ev:APIGatewayProxyEvent) : Promise<void> => {
    const value = await checkValidation(ev)
    await changePassword(value)
}

const checkValidation = async (ev:APIGatewayProxyEvent): Promise<void> => {
    const body = JSON.parse(ev.body || "")
    const requestSchema = joi.object({
        accessToken : joi.string().trim().required(),
        oldPassword: joi.string().trim().required(),
        newPassword: joi.string().trim().regex(/^(?=.*?[a-z])(?=.*?[A-Z])(?=.*?[0-9])[a-zA-Z\d@$!%*#?&]+/).required()
    })
    return await requestSchema.validateAsync(body,{abortEarly:false})
}

const changePassword = async (value:any):Promise<void> => {
    await cognito.changePassword({
        AccessToken: value.accessToken,
        PreviousPassword: value.oldPassword,
        ProposedPassword: value.newPassword
    }).promise()
}

const handlerError = (err:any):APIGatewayProxyResult => {
    if(err instanceof ValidationError){
        return{
            statusCode: 400,
            body: JSON.stringify({error:err})
        }
    }
    if(err.code === "NotAuthorizedException"){
        return{
            statusCode: 400,
            body: JSON.stringify({message: "Incorrect username or password"})
        }
    }
    if(err.code === "InvalidPasswordException"){
        return{
            statusCode: 400,
            body: JSON.stringify({message: "Password did not conform with policy"})
        }
    }
    if(err.code === "LimitExceededException"){
        return{
            statusCode:400,
            body: JSON.stringify({message:"limit exceeded. Please try again some time"})
        }
    }
    console.log(err)
    return{
        statusCode: 500,
        body: JSON.stringify({message: "Something went wrong"})
    }
}