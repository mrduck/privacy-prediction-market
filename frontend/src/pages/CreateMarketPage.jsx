import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { createMarketFromChain } from '../chainApi';
import { uploadImageToIPFS } from '../pinata-upload';

const CreateMarketPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);

    // 1. Extend form data: Add 'odds' field, corresponding to 'options' one-to-one
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '', // No category field in contract, can be used for frontend display (or ignored)
        options: ['', ''],
        odds: [100, 100], // Added: Odds (default 100 = 1.0x, must match length of 'options')
        endTime: '', // Voting end time
        resultTime: '' // Added: Result announcement time (must be later than endTime)
    });

    // 2. Handle input changes (added logic for odds change)
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...formData.options];
        newOptions[index] = value;
        setFormData({ ...formData, options: newOptions });
    };

    // Added: Handle odds changes
    const handleOddsChange = (index, value) => {
        const newOdds = [...formData.odds];
        newOdds[index] = Number(value); // Odds must be a number
        setFormData({ ...formData, odds: newOdds });
    };

    // 3. Sync odds when adding/removing options
    const addOption = () => {
        setFormData({
            ...formData,
            options: [...formData.options, ''],
            odds: [...formData.odds, 100] // Default odds 100 for new option
        });
    };

    const removeOption = (index) => {
        if (formData.options.length <= 2) return; // Keep at least 2 options
        const newOptions = formData.options.filter((_, i) => i !== index);
        const newOdds = formData.odds.filter((_, i) => i !== index);
        setFormData({ ...formData, options: newOptions, odds: newOdds });
    };

    // 4. Submit logic: First upload image to IPFS → Then create market
    const handleSubmit = async (e) => {
        e.preventDefault();
        let loadingToast = null;

        const { title, description, options, odds, endTime, resultTime, category } = formData;
        const validOptions = options.filter(opt => opt.trim());
        const validOdds = odds.filter(o => o > 0); // Odds must be positive

        // Basic validation
        if (!title.trim()) { alert('Please enter a title!'); return; }
        if (!category) {
            alert('Please select a category');
            return;
        }

        const categoryNum = Number(category);
        if (categoryNum < 1 || categoryNum > 5) {
            alert('Category must be a number between 1-5!');
            return;
        }

        if (validOptions.length < 2) { alert('At least 2 valid options required!'); return; }
        if (validOptions.length !== validOdds.length) { alert('Number of options must match number of odds!'); return; }

        // Timestamp conversion (contract requires second-level timestamps)
        const endTimeObj = new Date(endTime);
        const resultTimeObj = new Date(resultTime);
        if (endTimeObj <= new Date()) { alert('Voting end time must be later than current time!'); return; }
        if (resultTimeObj <= endTimeObj) { alert('Result announcement time must be later than voting end time!'); return; }
        const voteEndTime = Math.floor(endTimeObj.getTime() / 1000); // Convert to seconds
        const resultTimeSec = Math.floor(resultTimeObj.getTime() / 1000);

        try {
            setLoading(true);
            loadingToast = toast.loading('Publishing market...');
            // 5. Upload cover image to IPFS (if exists)
            const coverInput = document.getElementById('cover');
            const coverFile = coverInput?.files[0];
            console.log("Selected file:", coverFile); // Log file info (e.g., name, size)

            let imageUrl = '';
            if (coverFile) {
                console.log("Starting file upload:", coverFile.name);
                imageUrl = await uploadImageToIPFS(coverFile);
                console.log('Image uploaded successfully, IPFS URL:', imageUrl);
            } else {
                console.log("No image file selected");
            }
            console.log(`Market voting end time: ${voteEndTime}`);
            // 6. Call on-chain method to create market
            const marketId = await createMarketFromChain(
                title,
                description,
                imageUrl,
                categoryNum,
                validOptions,
                validOdds,
                voteEndTime,
                resultTimeSec
            );

            toast.dismiss(loadingToast);
            toast.success(`Creation successful! Market ID: ${marketId}`);
            navigate('/');
        } catch (err) {
            console.error('Failed to create market:', err);
            toast.dismiss(loadingToast);
            toast.error(`Creation failed: ${err.message}`);
        } finally {
            // 4. Whether success or failure, end request: Set loading to false
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">Create Prediction Market</h1>
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                {/* Title, Category, Description remain unchanged */}
                <div className="mb-4">
                    <label htmlFor="title" className="block text-sm font-medium mb-2">Prediction Market Title</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border"
                        placeholder="e.g., Will Tesla be profitable in Q3?"
                        required
                        style={{ color: "black" }}
                    />
                </div>

                <div className="mb-4">
                    <label htmlFor="category" className="block text-sm font-medium mb-2">Prediction Category</label>
                    <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                        style={{ color: "black" }}
                    >
                        <option value="">Please select a category</option>
                        <option value="1">Politics</option>
                        <option value="2">Sports</option>
                        <option value="3">Tech</option>
                        <option value="4">Economy</option>
                        <option value="5">Entertainment</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label htmlFor="description" className="block text-sm font-medium mb-2">Prediction Market Description</label>
                    <textarea
                        id="description"
                        name="description"
                        rows="4"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Detailed description of prediction content, rules, etc."
                        style={{ color: "black" }}
                    />
                </div>

                {/* Cover Upload (remains unchanged) */}
                <div className="mb-4">
                    <label htmlFor="cover" className="block text-sm font-medium mb-2">Market Cover Image (Optional)</label>
                    <input
                        type="file"
                        id="cover"
                        name="cover"
                        accept="image/*"
                        className="w-full px-3 py-2 border rounded-md"
                        style={{ color: "black" }}
                    />
                </div>

                {/* Prediction Options + Odds (added odds input) */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Prediction Options (At Least 2) & Odds</label>
                    {formData.options.map((option, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(index, e.target.value)}
                                className="flex-1 px-3 py-2 border rounded-md"
                                placeholder={`Option ${index + 1}`}
                                style={{ color: "black" }}
                            />
                            <input
                                type="number"
                                value={formData.odds[index]}
                                onChange={(e) => handleOddsChange(index, e.target.value)}
                                className="w-24 px-3 py-2 border rounded-md"
                                placeholder="Odds (e.g., 150=1.5x)"
                                min="1" // Minimum odds is 1
                                style={{ color: "black" }}
                            />
                            {formData.options.length > 2 && (
                                <button
                                    type="button"
                                    onClick={() => removeOption(index)}
                                    className="px-2 py-2 border rounded-md text-red-500 hover:bg-red-50"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addOption}
                        className="px-3 py-1 border rounded-md text-purple-600 hover:bg-purple-50"
                    >
                        + Add Option
                    </button>
                </div>

                {/* Time Selection: Added Result Announcement Time */}
                <div className="mb-4">
                    <label htmlFor="endTime" className="block text-sm font-medium mb-2">Voting End Time</label>
                    <input
                        type="datetime-local"
                        id="endTime"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                        style={{ color: "black" }}
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="resultTime" className="block text-sm font-medium mb-2">Result Announcement Time</label>
                    <input
                        type="datetime-local"
                        id="resultTime"
                        name="resultTime"
                        value={formData.resultTime}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                        style={{ color: "black" }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Must be later than voting end time, used to announce the final result
                    </p>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    // Disable button: Unclickable when loading is true
                    disabled={loading}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-400"
                >
                    {/* Show "Publishing..." when loading, else "Publish Prediction Market" */}
                    {loading ? 'Publishing...' : 'Publish Prediction Market'}
                </button>
            </form>
        </div>
    );
};

export default CreateMarketPage;