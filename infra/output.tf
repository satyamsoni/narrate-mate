output "api_endpoint" {
  value = "https://${aws_api_gateway_rest_api.api_app.id}.execute-api.${var.aws_region}.amazonaws.com/prod/"
}
output "cnd_endpoint"{
  value="https://${aws_cloudfront_distribution.cdn.domain_name}"
}