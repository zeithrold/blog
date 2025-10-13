type NotionErrorType
  = | 'invalid_json'
    | 'invalid_request_url'
    | 'invalid_request'
    | 'invalid_grant'
    | 'validation_error'
    | 'missing_version'
    | 'unauthorized'
    | 'restricted_resource'
    | 'object_not_found'
    | 'conflict_error'
    | 'rate_limited'
    | 'internal_server_error'
    | 'bad_gateway'
    | 'service_unavailable'
    | 'database_connection_unavailable'
    | 'gateway_timeout'

export interface NotionError {
  type: 'error'
  error: NotionErrorType
  message: string
  status: number
}
