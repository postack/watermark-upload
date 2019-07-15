# Serverless post image processing
Using one image as base, you can generate a full image resolution with watermark and a small version for speed loading and copyright. 

### Features
- Uses Jimp to process images
- Support png/jpg
- Ready to deploy serverless yml file
- Custom watermark

### Usage
- Update your aws credentials to `env.example.yml` and rename it to `env.yml`
- Run `npm run deploy`
- Configure your aws s3 bucket at the events tab under "properties" to point to your deployed lambda
![](https://github.com/postack/watermark-upload/images/aws_s3.png)

### Thanks to [MediaPatagonia.com.ar](https://mediapatagonia.com.ar) 
![](https://raw.githubusercontent.com/postack/watermark-upload/master/images/logo_small.png)
