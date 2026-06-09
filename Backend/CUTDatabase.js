{
    "User": {
        "userId": "ObjectId",
        "name": "String",
        "role": "String", // e.g., "adjuster", "supervisor"
        "email": "String",
        "password": "String" // Hashed
    },
    "Claim": {
        "claimId": "ObjectId",
        "userId": "ObjectId",
        "vehicleInfo": {
            "make": "String",
            "model": "String",
            "year": "Number",
            "vin": "String"
        },
        "claimDetails": {
            "description": "String",
            "amount": "Number",
            "documents": ["String"] // Array of document URLs
        },
        "status": "String", // e.g., "pending", "approved", "denied"
        "createdAt": "Date",
        "updatedAt": "Date"
    }
}

