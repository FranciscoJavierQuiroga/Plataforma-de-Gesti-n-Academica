#!/bin/bash
# Update Lambda environment variables directly via AWS CLI
# This fixes the issue where zappa update doesn't push new env vars

set -e

AWS_REGION="us-east-1"

# New environment variables to inject
ENV_VARS='{
  "ENVIRONMENT": "development",
  "KEYCLOAK_SERVER_URL": "https://lemur-3.cloud-iam.com/auth",
  "KEYCLOAK_REALM": "plataformainstitucional",
  "KEYCLOAK_CLIENT_ID": "01",
  "KEYCLOAK_CLIENT_SECRET": "wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz",
  "MONGO_URI": "mongodb+srv://fjquirogap200105_db_user:prueba123.@dbcolegio.b2xb5xo.mongodb.net/colegio?retryWrites=true&w=majority",
  "MONGO_DB_NAME": "colegio"
}'

SERVICES=(
  "login-service-dev"
  "teachers-service-dev"
  "students-service-dev"
  "groups-service-dev"
  "administrator-service-dev"
)

for FUNCTION_NAME in "${SERVICES[@]}"; do
  echo "Updating env vars for: $FUNCTION_NAME"
  
  # Get existing env vars
  EXISTING=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'Environment.Variables' \
    --output json 2>/dev/null || echo '{}')
  
  # Merge with service-specific vars
  SERVICE_VAR=$(echo "$EXISTING" | jq -r '.SERVICE_NAME // empty')
  if [ -n "$SERVICE_VAR" ]; then
    UPDATED=$(echo "$ENV_VARS" | jq --arg svc "$SERVICE_VAR" '. + {"SERVICE_NAME": $svc}')
  else
    UPDATED="$ENV_VARS"
  fi
  
  # Update Lambda configuration
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --environment "Variables=$UPDATED" \
    --no-cli-pager
  
  echo "  Updated successfully!"
  echo ""
done

echo "All Lambda environment variables updated!"
