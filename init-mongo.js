db = db.getSiblingDB('warranty_claims');

db.createCollection('claims');
db.createCollection('users');

print('Initialized warranty_claims database with claims and users collections');