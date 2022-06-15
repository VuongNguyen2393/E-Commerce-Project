import AWS from "aws-sdk";
import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const CATEGORY_TABLE = process.env.CATEGORY_TABLE || "";
const listAuthorizers = ["admin", "user"];

export const handler : APIGatewayProxyHandler = async (ev: APIGatewayProxyEvent) => {
  try {
    const result = await main(ev);
    return {
      statusCode: 200,
      body: JSON.stringify({ categories: result }),
    };
  } catch (err) {
    return handlerError(err);
  }
};

const main  = async (ev: APIGatewayProxyEvent) => {
  checkRole(ev);
  return await getCategoryList(ev);
};

const checkRole = async (ev: APIGatewayProxyEvent): Promise<void> => {
  const role = ev.requestContext.authorizer.claims["custom:role"] || "";
  if (!listAuthorizers.includes(role)) {
    throw {
      code: "NotAuthorize",
    };
  }
};

const getCategoryList = async (
  ev: APIGatewayProxyEvent
): Promise<AWS.DynamoDB.DocumentClient.ItemList> => {
  let categoryArray = [];
  const scanParams = {
    TableName: CATEGORY_TABLE,
    ProjectionExpression:"id,#name",
    ExpressionAttributeNames: {'#name': 'name'},
  };
  let result = await dynamoDB.scan(scanParams).promise();
  categoryArray = categoryArray.concat(result.Items);
  while (result.LastEvaluatedKey) {
    result = await dynamoDB.scan(scanParams).promise();
    categoryArray = categoryArray.concat(result.Items);
  }
  return categoryArray;
};

const handlerError = (err: any): APIGatewayProxyResult => {
  if (err.code === "NotAuthorize") {
    return {
      statusCode: 401,
      body: JSON.stringify({
        message: "you don't have permission to use this function",
      }),
    };
  }
  console.log(err);
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Something went wrong" }),
  };
};
