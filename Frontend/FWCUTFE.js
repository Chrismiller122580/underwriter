// FWCUTFE.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';

const ClaimsList = () => {
    const [claims, setClaims] = useState([]);

    useEffect(() => {
        const fetchClaims = async () => {
            const response = await axios.get('/claims');
            setClaims(response.data);
        };
        fetchClaims();
    }, []);

    return (
        <div>
            <h1>Claims List</h1>
            <ul>
                {claims.map(claim => (
                    <li key={claim._id}>
                        {claim.vehicleInfo.make} {claim.vehicleInfo.model} - {claim.status}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const AddClaim = () => {
    const [formData, setFormData] = useState({
        vehicleInfo: {
            make: '',
            model: '',
            year: '',
            vin: ''
        },
        claimDetails: {
            description: '',
            amount: '',
            documents: []
        }
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await axios.post('/claims', formData);
        // Redirect or show success message
    };

    return (
        <form onSubmit={handleSubmit}>
            <h1>Add Claim</h1>
            <label>Make</label>
            <input name="make" onChange={handleChange} />
            <label>Model</label>
            <input name="model" onChange={handleChange} />
            <label>Year</label>
            <input name="year" onChange={handleChange} />
            <label>VIN</label>
            <input name="vin" onChange={handleChange} />
            <label>Description</label>
            <textarea name="description" onChange={handleChange}></textarea>
            <label>Amount</label>
            <input name="amount" onChange={handleChange} />
            <button type="submit">Submit</button>
        </form>
    );
};

const App = () => (
    <div>
        <AddClaim />
        <ClaimsList />
    </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
