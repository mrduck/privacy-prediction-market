import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";

const EventCreate = () => {
    const { walletAddress, contract } = useAppContext();
    const [question, setQuestion] = useState("");
    const [endTime, setEndTime] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!walletAddress) return toast.error("请先连接钱包");
        if (!question) return toast.error("请输入事件问题");
        if (!endTime) return toast.error("请选择截止时间");

        try {
            setIsLoading(true);
            const endTimeStamp = Math.floor(new Date(endTime).getTime() / 1000);
            if (endTimeStamp <= Date.now() / 1000) {
                return toast.error("截止时间必须晚于现在");
            }
            // 暂时模拟创建成功（后续对接合约）
            toast.success("事件创建成功（模拟）！");
            setQuestion("");
            setEndTime("");
        } catch (error) {
            toast.error(`创建失败：${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!walletAddress) {
        return (
            <div className="bg-white rounded-lg shadow p-6 opacity-70">
                <h2 className="text-xl font-semibold mb-2">创建预测事件</h2>
                <p className="text-gray-500">连接钱包后可创建事件</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">创建预测事件</h2>
            <div className="space-y-4">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="例如：2024年某球赛A队会胜吗？"
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
                    {isLoading ? "创建中..." : "创建事件"}
                </button>
            </div>
        </div>
    );
};

export default EventCreate;