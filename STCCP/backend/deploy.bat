@echo off
echo ===== Building the application =====
node deployment.mjs
echo.

echo ===== Deploying to Azure Web App =====
echo Make sure you are logged in to Azure CLI before continuing
echo.
set /p continue="Are you logged in to Azure CLI? (Y/N): "
if /i "%continue%" neq "Y" goto :end

echo.
az webapp deployment source config-zip --resource-group "STCCP" --name "STCCP-backend" --src ./dist.zip
echo.
echo Deployment completed. Check the Azure portal for status.
goto :eof

:end
echo Please login to Azure CLI using 'az login' before deploying.
