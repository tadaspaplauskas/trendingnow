#forever stopall
#NODE_ENV=production forever start -a --uid "app" app.js
#NODE_ENV=production forever start -a --uid "services" services.js

# pm2 deploy script
pm2 delete trendingnow-app
NODE_ENV=production pm2 start app.js --watch --name trendingnow-app
pm2 delete trendingnow-services
NODE_ENV=production pm2 start services.js --watch --name trendingnow-services
