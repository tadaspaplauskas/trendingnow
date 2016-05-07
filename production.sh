#forever stopall
#NODE_ENV=production forever start -a --uid "app" app.js
#NODE_ENV=production forever start -a --uid "services" services.js

pm2 delete all
NODE_ENV=production pm2 start app.js --watch
NODE_ENV=production pm2 start services.js --watch