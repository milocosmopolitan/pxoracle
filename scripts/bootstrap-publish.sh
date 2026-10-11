#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export AWS_PROFILE="${AWS_PROFILE:-milo}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_PAGER=""
export SAM_CLI_TELEMETRY=0
repository=milocosmopolitan/pxoracle
account=$(aws sts get-caller-identity --query Account --output text)
provider="arn:aws:iam::$account:oidc-provider/token.actions.githubusercontent.com"
# Reuse the account's provider; never replace trust used by other repositories.
aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$provider" >/dev/null
sam deploy --template-file infra/bootstrap.json --stack-name pxoracle-publish-bootstrap \
  --region "$AWS_REGION" --capabilities CAPABILITY_NAMED_IAM \
  --no-confirm-changeset --no-fail-on-empty-changeset --no-progressbar \
  --parameter-overrides "OidcProviderArn=$provider" "GitHubRepository=$repository" \
  --tags Project=pxoracle
publish_role=$(aws cloudformation describe-stacks --stack-name pxoracle-publish-bootstrap \
  --query "Stacks[0].Outputs[?OutputKey=='PublishRoleArn'].OutputValue | [0]" --output text)
formation_role=$(aws cloudformation describe-stacks --stack-name pxoracle-publish-bootstrap \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFormationRoleArn'].OutputValue | [0]" --output text)
gh variable set AWS_REGION --repo "$repository" --body "$AWS_REGION"
gh variable set AWS_ACCOUNT_ID --repo "$repository" --body "$account"
gh variable set AWS_PUBLISH_ROLE_ARN --repo "$repository" --body "$publish_role"
gh variable set AWS_CLOUDFORMATION_ROLE_ARN --repo "$repository" --body "$formation_role"
echo "OIDC bootstrap ready. Publish PXOracle is manual-only on main."
