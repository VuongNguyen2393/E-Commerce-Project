import AWS , {S3} from "aws-sdk"
import sharp from "sharp"
import { S3Event } from "aws-lambda"

const s3 = new S3({signatureVersion:"v4"})
const dynamoDB = new AWS.DynamoDB.DocumentClient()
const PRODUCT_TABLE = process.env.PRODUCT_TABLE || ""

export const handler: any = async (ev:S3Event) => {
    try{
        await main(ev)
        console.log({message: "Create thumbnail successfully"})
    }catch(err){
        return handlerError(err)
    }
}

const main = async (ev:S3Event):Promise<void> => {
    const {srcKey,srcBucket,dstKey} = await variableS3(ev)
    const image = await getImage(srcKey,srcBucket)
    const buffer = await resizeImage(image)
    await uploadThumbnail(dstKey,srcBucket,buffer)
    await updateThumbnailPath(dstKey,srcKey)
}

const variableS3 = async (ev:S3Event) => {
    const srcBucket = ev.Records[0].s3.bucket.name
    const srcKey = decodeURIComponent(ev.Records[0].s3.object.key) || ""
    const dstKey = "resized-" + srcKey.split("/").pop()
    return {srcKey,srcBucket,dstKey}
}

const getImage = async(srcKey:string, srcBucket:string)=> {
    return await s3.getObject({
        Bucket: srcBucket,
        Key: srcKey
    }).promise()
}

const resizeImage = async (image:any) => {
    return await sharp(image.Body).resize(50,50).toBuffer()
}

const uploadThumbnail = async (dstKey:string,srcBucket:string,buffer:any):Promise<void> => {
    await s3.putObject({
        Bucket: srcBucket,
        Key: "thumbnail/" + dstKey,
        Body: buffer,
        ContentType: "image"
    }).promise()
}

const updateThumbnailPath = async (dstKey:string,srcKey:string):Promise<void> => {
    await dynamoDB.update({
        TableName: PRODUCT_TABLE,
        Key: { id: srcKey.split("/").pop().split(".")[0] || ""},
        UpdateExpression: "set thumbnail = :img",
        ExpressionAttributeValues: { ":img":"thumbnail/" + dstKey}
    }).promise()
}

const handlerError = (err:any) => {
    console.log(err)
}