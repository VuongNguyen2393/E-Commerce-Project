import {
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
} from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";
import Joi, { ValidationError } from "joi";

const CLIENT_ID = process.env.CLIENT_ID || "";
const cognito = new CognitoIdentityServiceProvider();

export const handler: APIGatewayProxyHandler = async (ev:any) => {
  try {
    await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Sign Up Success" }),
    };
  } catch (err:any) {
    return handlerError(err);
  }
};

const main = async (ev: APIGatewayProxyEvent) => {
  const value = await checkValidation(ev);
  await signUpToCognito(value);
}

const checkValidation = async (ev: APIGatewayProxyEvent) => {
  const body = JSON.parse(ev.body || "{}")
  const user_schema = Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().trim().regex(/^(?=.*?[a-z])(?=.*?[A-Z])(?=.*?[0-9])[a-zA-Z\d@$!%*#?&]+/).required()
  });
  let value = await user_schema.validateAsync(body, { abortEarly: false });
  value.role = "user"
  return value
};

const signUpToCognito = async (value: any) => {
  await cognito
    .signUp({
      ClientId: CLIENT_ID,
      Password: value.password,
      Username: value.email,
      UserAttributes: [
        {
          Name: "custom:role",
          Value: value.role,
        },
      ],
    })
    .promise();
};

const handlerError = (err: any): APIGatewayProxyResult => {
  if (err instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({error:err}),
    };
  }
  if (err.code === "UsernameExistsException") {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Email Was Exist!!" }),
    };
  }
  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
}
