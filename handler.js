// dependencies
const async = require('async');
const AWS = require('aws-sdk');
const Jimp = require('jimp');
const util = require('util');

// constants
const MAX_WIDTH  = 100;
const MAX_HEIGHT = 100;

// get reference to S3 client 
const config = new AWS.Config({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION
});
AWS.config.update(config);
const s3 = new AWS.S3();

exports.watermark = function(event, context, callback) {
    // Read options from the event.
    console.log('HOLA')
    //console.log("Reading options from event:\n", event);
    const srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey    = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));  
    const dstBucket = process.env.PUBLIC_BUCKET+'/static/images';
    const dstKey    = srcKey;

    // Sanity check: validate that source and destination are different buckets.
    if (srcBucket == dstBucket) {
        callback("Source and destination buckets are the same.");
        return;
    }

    // Infer the image type.
    const typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        callback("Could not determine the image type.");
        return;
    }
    const imageType = typeMatch[1].toLowerCase();
    if (imageType != "jpg" && imageType != "png") {
        callback(`Unsupported image type: ${imageType}`);
        return;
    }

    // Download the image from S3, transform, and upload to a different S3 bucket.
    async.waterfall([
        function download(next) {
            // Download the image from S3 into a buffer.
            console.log('to download', srcBucket, srcKey)
            s3.getObject({
                    Bucket: srcBucket,
                    Key: srcKey
                },
                next);
            },
        function transform(response, next) {
          console.log('got first image')
          Promise.all([
            Jimp.read(response.Body),
            Jimp.read('./watermark.png'),
          ])
            .then(images => {
              console.log('got images')
              const resized = images[0].clone()
                .scaleToFit(600, 600) // resize
                .quality(90) // set JPEG quality
                .getBufferAsync(Jimp.MIME_JPEG); // buffer
              const watermark = images[0]
                .composite(images[1], 100, 0, {
                  mode: Jimp.BLEND_MULTIPLY,
                  opacitySource: 0.5,
                  opacityDest: 0.5
                })
                .getBufferAsync(Jimp.MIME_JPEG);

              return Promise.all([resized, watermark])
            })
            .then((buffers) => {
              console.log('BUFFERS', buffers)
              if (!buffers) {
                next(err);
              } else {
                next(null, response.ContentType, buffers);
              }
            })
            .catch(err => {
              console.error(err);
            });
        },
        function uploadResized(contentType, data, next) {
            // Stream the transformed image to a different S3 bucket.
            console.log('upload resized', contentType, data)
            s3.putObject({
              Bucket: dstBucket,
              Key: `small_${dstKey}`,
              Body: data[0],
              ContentType: contentType
            },
            () => {
              next(null, contentType, data)
            });
        },
        function uploadWatermark(contentType, data, next) {
            console.log('upload watermark', contentType, data)
            // Stream the transformed image to a different S3 bucket.
            s3.putObject({
              Bucket: dstBucket,
              Key: `w_${dstKey}`,
              Body: data[1],
              ContentType: contentType
            },
            next);
        }
        ], function (err) {
            if (err) {
                console.error(
                    'Unable to complete tasks ' + srcBucket + '/' + srcKey +
                    ' and upload to ' + dstBucket + '/' + dstKey +
                    ' due to an error: ' + err
                );
            } else {
                console.log(
                    'Successfully completed tasks ' + srcBucket + '/' + srcKey +
                    ' and uploaded to ' + dstBucket + '/' + dstKey
                );
            }

            callback(null, "message");
        }
    );
};