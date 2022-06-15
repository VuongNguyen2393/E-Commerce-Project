import {
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
} from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";
import Joi, { ValidationError } from "joi";

const CLIENT_ID = process.env.CLIENT_ID || "";
const AUTH_FLOW = process.env.AUTH_FLOW || "";
const cognito = new CognitoIdentityServiceProvider();

export const handler: APIGatewayProxyHandler = async (ev) => {
  try {
    const result = await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return handlerError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent) => {
  const value = await checkValidation(ev);
  return await signInToCognito(value);
}

const checkValidation = async (ev: APIGatewayProxyEvent) => {
  const body = ev.body ? JSON.parse(ev.body) : {};
  const user_schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });
  return await user_schema.validateAsync(body, { abortEarly: false });
};

const signInToCognito = async (value: any) => {
  const result = await cognito
    .initiateAuth({
      ClientId: CLIENT_ID,
      AuthFlow: AUTH_FLOW,
      AuthParameters: {
        USERNAME: value.email,
        PASSWORD: value.password,
      },
    })
    .promise();
  const idToken = result.AuthenticationResult?.IdToken;
  const accessToken = result.AuthenticationResult?.AccessToken;
  const refreshToken = result.AuthenticationResult?.RefreshToken;
  return { idToken, accessToken, refreshToken };
};

const handlerError = (err: any): APIGatewayProxyResult => {
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({error: err}),
    };
  }
  if (err.code === "NotAuthorizedException") {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Incorrect email or password"}),
    };
  }
  if (err.code === "UserNotFoundException") {
    return {
      statusCode: 401,
      body: JSON.stringify({messsage: "acount not exist"})
    }
  }
  if (err.code === "UserNotConfirmedException") {
    return {
      statusCode: 401,
      body: JSON.stringify({message: "User didn't confirm yet"})
    }
  }
  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
}
