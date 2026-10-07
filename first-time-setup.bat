@echo off
echo Seeding owner user for HS Pharma...
cd apps\api
call pnpm run seed:owner
pause
