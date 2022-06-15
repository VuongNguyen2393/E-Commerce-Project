import {
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
} from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";
import Joi, { ValidationError } from "joi";

const CLIENT_ID = process.env.CLIENT_ID || "";
const cognito = new CognitoIdentityServiceProvider();

export const handler: APIGatewayProxyHandler = async (ev) => {
  try {
    const result = await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Confirm Successfully" }),
    };
  } catch (err) {
    return handlerError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent) => {
  const value = await checkValidation(ev);
  await confirmSigUp(value);
}

const checkValidation = async (ev: APIGatewayProxyEvent) => {
  const body = ev.body ? JSON.parse(ev.body) : {};
  const confirm_schema = Joi.object({
    email: Joi.string().email().required(),
    confirmationCode: Joi.string().required(),
  });
  return await confirm_schema.validateAsync(body, { abortEarly: false });
};

const confirmSigUp = async (value: any) => {
  await cognito
    .confirmSignUp({
      ClientId: CLIENT_ID,
      ConfirmationCode: value.confirmationCode,
      Username: value.email,
    })
    .promise();
};

const handlerError = (err: any): APIGatewayProxyResult =>{
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify(err),
    };
  }
  if (
    err.code === "CodeMismatchException" ||
    "NotAuthorizedException" ||
    "ExpiredCodeException"
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify(err),
    };
  }
  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
}
