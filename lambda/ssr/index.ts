import { CloudFrontResponseEvent, CloudFrontResponseHandler, CloudFrontResponseResult } from "aws-lambda";

/**
 * https://www.npmjs.com/package/chrome-aws-lambda
 */
export const handler = async (event: CloudFrontResponseEvent, context: any, callback: any) => {
    console.log("Event:");
    console.log(event);
    console.log("Context:");
    console.log(context);
    
    const record = event.Records[0].cf;
    console.log("Record:");
    console.log(record);

    callback(null, record.response);
};
