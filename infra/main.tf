# S3 Bucket
resource "aws_s3_bucket" "primary_bucket" {
  bucket = var.bucket_name
  force_destroy = true  # for easy cleanup
}

resource "aws_s3_bucket_cors_configuration" "s3_cors" {
  bucket = var.bucket_name
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}
# DynamoDB Tables
resource "aws_dynamodb_table" "ddb_books" {
  name         = var.ddb_books
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  range_key    = "name"
  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "name"
    type = "S"
  }
}

resource "aws_dynamodb_table" "ddb_users" {
  name         = var.ddb_users
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  range_key    = "username"
  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "username"
    type = "S"
  }
}

resource "aws_dynamodb_table_item" "user" {
  table_name = aws_dynamodb_table.ddb_users.name
  hash_key   = aws_dynamodb_table.ddb_users.hash_key
  range_key  = aws_dynamodb_table.ddb_users.range_key
  item = <<ITEM
{
  "id": {"S": "c4ca4238a0b923820dcc509a6f75849b"},
  "username": {"S": "satyam"},
  "first_name": {"S": "Satyam"},
  "last_name": {"S": "Soni"},
  "email": {"S": "satyamsoni@gmail.com"},
  "password": {"S": "3f01c1e4086b4e8517dd69b07889b615"},
  "language": {"S": "english"},
  "photo": {"S": ""}
}
ITEM
  depends_on = [aws_dynamodb_table.ddb_users]
}

resource "aws_dynamodb_table" "ddb_languages" {
  name         = var.ddb_languages
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  range_key    = "name"
  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "name"
    type = "S"
  }
}

resource "aws_dynamodb_table_item" "languages" {
  for_each   = local.ddb_language_items
  table_name = aws_dynamodb_table.ddb_languages.name
  hash_key   = "id"
  range_key  = "name"
   item = jsonencode({
    id         = { S = each.value.id }
    name   = { S = each.value.name }
    code = { S = each.value.code }
    voice_id  = { S = each.value.voice_id }
  })
  depends_on = [aws_dynamodb_table.ddb_languages]
}

# IAM Role for both Lambdas
resource "aws_iam_role" "lambda_role" {
  name = "${var.product_slug}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    },
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "textract.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  })
}

# IAM Policy Attachment
resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.product_slug}-lambda-policy"
  description = "Policy for ${var.product} Lambdas"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        Action = [
          "s3:*"
        ]
        Effect   = "Allow"
        Resource = [
          aws_s3_bucket.primary_bucket.arn,
          "${aws_s3_bucket.primary_bucket.arn}/*"
        ]
      },
      {
        Action = [
          "sns:Publish"
        ]
        Effect   = "Allow"
        Resource = aws_sns_topic.sns1.arn
      },
      {
        Action = [
          "dynamodb:*"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.ddb_books.arn
      },
      {
        Action = [
          "polly:*"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "bedrock:InvokeModel"
        ],
        Resource = "arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
      },
      {
        Effect = "Allow",
        Action = [
          "textract:StartDocumentAnalysis",
          "textract:GetDocumentAnalysis"
        ],
        Resource = "*"
      },
      {
        Action = [
          "dynamodb:*"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.ddb_users.arn
      },{
        Action = [
          "dynamodb:*"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.ddb_languages.arn
      },
      {
        "Effect": "Allow",
        "Action": "translate:TranslateText",
        "Resource": "*"
      }
    ]
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "attach_policy_to_role" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

# Archive API Lambda code
data "archive_file" "api_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../${var.api_lambda}"
  output_path = "${path.module}/../${var.api_lambda}.zip"
}

# Lambda: API Lambda
resource "aws_lambda_function" "api_lambda" {
  function_name = var.api_lambda
  description   = "Narrate Mate API Lambda"
  runtime       = "nodejs22.x"
  timeout       = 60
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  filename         = "${path.module}/../${var.api_lambda}.zip"
  source_code_hash = filebase64sha256("${path.module}/../${var.api_lambda}.zip")
  architectures = ["arm64"]
  memory_size = 256
  # Environment variables
  environment {
    variables = {
      S3_BUCKET   = aws_s3_bucket.primary_bucket.id
      DDB_BOOKS   = aws_dynamodb_table.ddb_books.name
      DDB_USERS   = aws_dynamodb_table.ddb_users.name
      DDB_LANGUAGES = aws_dynamodb_table.ddb_languages.name
      SNS_TOPIC   = aws_sns_topic.sns1.arn
    }
  }
  depends_on = [
    aws_iam_role.lambda_role,
    aws_s3_bucket.primary_bucket,
    aws_dynamodb_table.ddb_books,
    aws_dynamodb_table.ddb_users
    ]
}
# PDF 2 image layer
resource "aws_lambda_layer_version" "pdf2img_layer" {
  layer_name               = "pdf2img"
  s3_bucket                = var.bucket_name
  s3_key                   = "layers/pdf2img-layer.zip"
  compatible_runtimes      = ["nodejs22.x"]
  compatible_architectures = ["arm64","x86_64"]

  description = "Custom layer with Poppler and ImageMagick for Lambda"
}

# Archive Lambda code
data "archive_file" "bg_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../${var.bg_lambda}"
  output_path = "${path.module}/../${var.bg_lambda}.zip"
}
# Lambda: Background Lambda
resource "aws_lambda_function" "bg_lambda" {
  function_name = var.bg_lambda
  description   = "Narrate Mate Background Job"
  runtime       = "nodejs22.x"
  timeout       = 120
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  filename      = "${path.module}/../${var.bg_lambda}.zip"
  source_code_hash = filebase64sha256("${path.module}/../${var.bg_lambda}.zip")
  architectures = ["x86_64"]
  memory_size = 512
  # Environment variables
  environment {
    variables = {
      S3_BUCKET   = aws_s3_bucket.primary_bucket.id
      DDB_BOOKS   = aws_dynamodb_table.ddb_books.name
      DDB_USERS   = aws_dynamodb_table.ddb_users.name
      DDB_LANGUAGES = aws_dynamodb_table.ddb_languages.name
      SNS_TOPIC   = aws_sns_topic.sns1.arn,
      ROLE_ARN    = aws_iam_role.lambda_role.arn
    }
  }
  layers = [
    aws_lambda_layer_version.pdf2img_layer.arn
  ]
  depends_on = [
    aws_iam_role.lambda_role,
    aws_s3_bucket.primary_bucket,
    aws_dynamodb_table.ddb_books,
    aws_dynamodb_table.ddb_users,
    aws_dynamodb_table.ddb_languages,
    aws_lambda_layer_version.pdf2img_layer
    ]
}

# SNS Topic
resource "aws_sns_topic" "sns1" {
  name = var.sns1
}

# SNS Subscription → trigger bg Lambda
resource "aws_sns_topic_subscription" "sns_to_bg_lambda" {
  topic_arn = aws_sns_topic.sns1.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.bg_lambda.arn
  depends_on = [
    aws_lambda_function.bg_lambda,
    aws_sns_topic.sns1
    ]
}

# Grant permission for SNS to invoke Lambda
resource "aws_lambda_permission" "allow_sns_to_invoke_bg_lambda" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bg_lambda.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.sns1.arn
  depends_on = [
    aws_lambda_function.bg_lambda,
    aws_sns_topic.sns1
    ]
}

# S3 Notification → trigger bg Lambda on temp/*.pdf
resource "aws_s3_bucket_notification" "s3_to_bg_lambda" {
  bucket = aws_s3_bucket.primary_bucket.id
  lambda_function {
    lambda_function_arn = aws_lambda_function.bg_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "temp/"
    filter_suffix       = ".pdf"
  }
  depends_on = [
    aws_lambda_permission.allow_s3_to_invoke_bg_lambda
    ]
}

# Allow S3 to invoke Lambda
resource "aws_lambda_permission" "allow_s3_to_invoke_bg_lambda" {
  statement_id  = "AllowExecutionFromS3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bg_lambda.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.primary_bucket.arn
  depends_on = [
    aws_s3_bucket.primary_bucket,
    aws_lambda_function.bg_lambda
    ]
}

resource "aws_iam_role" "api_gateway_execution_role" {
  name = "${var.product}-api-gateway-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    },
    {
      "Effect": "Allow",
      "Principal": { "Service": "textract.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
    ]
  })
  
}
resource "aws_iam_role_policy" "api_gateway_invoke_lambda" {
  name = "${var.product}-invoke-lambda"
  role = aws_iam_role.api_gateway_execution_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "lambda:InvokeFunction"
        ],
        Resource = aws_lambda_function.api_lambda.arn
      }
    ]
  })
  depends_on = [
    aws_lambda_function.api_lambda,
    aws_api_gateway_rest_api.api_app
    ]
}

resource "aws_api_gateway_rest_api" "api_app" {
   name        = var.api_app
  description = "${var.product} API from Open API"
  body = templatefile("${path.module}/open_api.yaml", {
    AWS_REGION     = var.aws_region,
    API_LAMBDA_ARN = aws_lambda_function.api_lambda.invoke_arn,
    AWS_ACCOUNT_ID = var.aws_account_id,
    API_GATEWAY_EXECUTION_ROLE = aws_iam_role.api_gateway_execution_role.name,
    OAUTH_URI = "NONE"
  })
  lifecycle {
    ignore_changes = [body] # Optional: avoid update loop
  }
  depends_on = [
    aws_lambda_function.api_lambda
    ]
}
# Lambda permission for API Gateway to invoke Lambda
resource "aws_lambda_permission" "allow_apigw_invoke_api_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api_app.execution_arn}/*/*"
  depends_on = [
    aws_api_gateway_rest_api.api_app,
    aws_lambda_function.api_lambda
    ]
}


resource "aws_api_gateway_deployment" "api_app_deployment" {
  depends_on = [aws_api_gateway_rest_api.api_app]
  rest_api_id = aws_api_gateway_rest_api.api_app.id
  description = "Deployment for prod stage"
}
resource "aws_api_gateway_stage" "api_app_stage" {
  depends_on = [aws_api_gateway_rest_api.api_app]
  rest_api_id    = aws_api_gateway_rest_api.api_app.id
  stage_name     = "prod"
  deployment_id  = aws_api_gateway_deployment.api_app_deployment.id
  description    = "Prod stage for Narrate Mate API"
  # Optional settings (highly recommended!)
  variables = {
    lambdaAlias = "live"
  }
}

resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "s3-oac-access"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name              = aws_s3_bucket.primary_bucket.bucket_regional_domain_name
    origin_id                = "s3-origin-books"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  enabled             = true
  default_root_object = ""

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-origin-books"

    forwarded_values {
      query_string = false

      headers = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
  depends_on = [
    aws_s3_bucket.primary_bucket
    ]
}
resource "aws_s3_bucket_policy" "books_cdn_policy" {
  bucket = aws_s3_bucket.primary_bucket.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = [
          "${aws_s3_bucket.primary_bucket.arn}/books/*"
        ]
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn
          }
        }
      }
    ]
  })
}