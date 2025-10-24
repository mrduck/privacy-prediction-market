import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";

const EventCreate = () => {
    const { walletAddress, contract } = useAppContext();
    const [question, setQuestion] = useState("");
    const [endTime, setEndTime] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!walletAddress) return toast.error("Please connect your wallet first");
        if (!question) return toast.error("Please enter the event question");
        if (!endTime) return toast.error("Please select an end time");

        try {
            setIsLoading(true);
            const endTimeStamp = Math.floor(new Date(endTime).getTime() / 1000);
            if (endTimeStamp <= Date.now() / 1000) {
                return toast.error("The end time must be later than now");
            }
            // Temporarily simulate successful creation (to be connected to contract later)
            toast.success("Event created successfully (simulation)!");
            setQuestion("");
            setEndTime("");
        } catch (error) {
            toast.error(`Creation failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!walletAddress) {
        return (
            <div className="bg-white rounded-lg shadow p-6 opacity-70">
                <h2 className="text-xl font-semibold mb-2">Create Prediction Event</h2>
                <p className="text-gray-500">Connect wallet to create events</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Create Prediction Event</h2>
            <div className="space-y-4">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., Will Team A win the 2024 match?"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
                <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={handleCreate}
                    disabled={isLoading}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                    {isLoading ? "Creating..." : "Create Event"}
                </button>
            </div>
        </div>
    );
};

export default EventCreate;