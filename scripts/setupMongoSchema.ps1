# Define MongoDB connection details
$mongoHost = "localhost"
$mongoPort = "27017"
$databaseName = "warranty_claims"

# Define the JSON schema for the collections
$userSchema = @"
{
    "\$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "role", "email", "password"],
        "properties": {
            "name": {
                "bsonType": "string",
                "description": "Name of the user"
            },
            "role": {
                "bsonType": "string",
                "description": "Role of the user (e.g., adjuster, supervisor)"
            },
            "email": {
                "bsonType": "string",
                "description": "Email of the user"
            },
            "password": {
                "bsonType": "string",
                "description": "Hashed password of the user"
            }
        }
    }
}
"@

$claimSchema = @"
{
    "\$jsonSchema": {
        "bsonType": "object",
        "required": ["userId", "vehicleInfo", "claimDetails", "status"],
        "properties": {
            "userId": {
                "bsonType": "objectId",
                "description": "ID of the user who filed the claim"
            },
            "vehicleInfo": {
                "bsonType": "object",
                "required": ["make", "model", "year", "vin"],
                "properties": {
                    "make": {
                        "bsonType": "string",
                        "description": "Vehicle make"
                    },
                    "model": {
                        "bsonType": "string",
                        "description": "Vehicle model"
                    },
                    "year": {
                        "bsonType": "int",
                        "description": "Vehicle year"
                    },
                    "vin": {
                        "bsonType": "string",
                        "description": "Vehicle Identification Number"
                    }
                }
            },
            "claimDetails": {
                "bsonType": "object",
                "required": ["description", "amount", "documents"],
                "properties": {
                    "description": {
                        "bsonType": "string",
                        "description": "Description of the claim"
                    },
                    "amount": {
                        "bsonType": "double",
                        "description": "Claim amount"
                    },
                    "documents": {
                        "bsonType": ["array"],
                        "items": {
                            "bsonType": "string"
                        },
                        "description": "List of document URLs"
                    }
                }
            },
            "status": {
                "bsonType": "string",
                "description": "Status of the claim (e.g., pending, approved, denied)"
            },
            "createdAt": {
                "bsonType": "date",
                "description": "Creation date of the claim"
            },
            "updatedAt": {
                "bsonType": "date",
                "description": "Last update date of the claim"
            }
        }
    }
}
"@

# Create the collections with schemas
$commands = @(
    @{
        Collection = "users"
        Schema = $userSchema
    },
    @{
        Collection = "claims"
        Schema = $claimSchema
    }
)

foreach ($command in $commands) {
    $collection = $command.Collection
    $schema = $command.Schema

    $mongoCommand = @"
db.createCollection("$collection", {
    validator: $schema
});
"@

    Write-Host "Creating collection $collection with schema..."
    mongo --host $mongoHost --port $mongoPort $databaseName --eval $mongoCommand
}

Write-Host "Database schema setup complete."
