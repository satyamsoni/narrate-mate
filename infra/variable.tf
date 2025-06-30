variable "aws_region" {
  default = "eu-west-1"
}
variable "aws_account_id"{
  default ="487500412950"
}
variable "product" {
  default ="NarrateMate"
}
variable "product_slug" {
  default ="narrate-mate"
}
variable "bucket_name" {
  default = "narrate-mate"
}

variable "ddb_books" {
  default = "nm-books"
}
variable "ddb_users" {
  default = "nm-users"
}
variable "ddb_languages"{
  default = "nm-languages"
}

variable "sns1" {
  default = "textract_narrate_mate"
}

variable "api_lambda"{
  default = "api-narrate-mate"
}

variable "oauth_lambda"{
  default = "oauth-narrate-mate"
}

variable "bg_lambda"{
  default = "bg-job-narrate-mate"
}

variable "api_app"{
  default = "api-narrate-mate"
}