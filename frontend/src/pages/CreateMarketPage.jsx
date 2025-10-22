import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { createMarketFromChain } from '../chainApi';
import {uploadImageToIPFS} from '../pinata-upload';

const CreateMarketPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);

    // 1. 扩展表单数据：增加 odds（赔率）字段，与 options 一一对应
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '', // 合约中无分类字段，可作为前端展示用（或忽略）
        options: ['', ''],
        odds: [100, 100], // 新增：赔率（默认 100 = 1.0x，需与 options 长度一致）
        endTime: '', // 投票截止时间
        resultTime: '' // 新增：结果公布时间（需晚于 endTime）
    });

    // 2. 处理输入变化（新增 odds 变化逻辑）
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...formData.options];
        newOptions[index] = value;
        setFormData({ ...formData, options: newOptions });
    };

    // 新增：处理赔率变化
    const handleOddsChange = (index, value) => {
        const newOdds = [...formData.odds];
        newOdds[index] = Number(value); // 赔率需为数字
        setFormData({ ...formData, odds: newOdds });
    };

    // 3. 新增/删除选项时，同步处理赔率
    const addOption = () => {
        setFormData({
            ...formData,
            options: [...formData.options, ''],
            odds: [...formData.odds, 100] // 新增选项默认赔率 100
        });
    };

    const removeOption = (index) => {
        if (formData.options.length <= 2) return; // 至少保留 2 个选项
        const newOptions = formData.options.filter((_, i) => i !== index);
        const newOdds = formData.odds.filter((_, i) => i !== index);
        setFormData({ ...formData, options: newOptions, odds: newOdds });
    };

    // 4. 提交逻辑：先上传图片 → 再创建市场
    const handleSubmit = async (e) => {
        e.preventDefault();
        let loadingToast = null;

        const { title, description, options, odds, endTime, resultTime ,category} = formData;
        const validOptions = options.filter(opt => opt.trim());
        const validOdds = odds.filter(o => o > 0); // 赔率需为正数

        // 基础验证
        if (!title.trim()) { alert('请输入标题！'); return; }
        if (!category) {
            alert('Please select a category');
            return;
        }

        const categoryNum = Number(category);
        if (categoryNum < 1 || categoryNum > 5) {
            alert('分类必须是 1-5 之间的数字！');
            return;
        }

        if (validOptions.length < 2) { alert('至少2个有效选项！'); return; }
        if (validOptions.length !== validOdds.length) { alert('选项与赔率数量需一致！'); return; }

        // 时间戳转换（合约需要秒级时间戳）
        const endTimeObj = new Date(endTime);
        const resultTimeObj = new Date(resultTime);
        if (endTimeObj <= new Date()) { alert('投票结束时间必须晚于当前时间！'); return; }
        if (resultTimeObj <= endTimeObj) { alert('结果公布时间必须晚于投票结束时间！'); return; }
        const voteEndTime = Math.floor(endTimeObj.getTime() / 1000); // 转秒级
        const resultTimeSec = Math.floor(resultTimeObj.getTime() / 1000);

        try {
            setLoading(true);
            loadingToast = toast.loading('正在发布市场...');
            // 5. 上传封面图片到 IPFS（若有）
            const coverInput = document.getElementById('cover');
            const coverFile = coverInput?.files[0];
            console.log("选中的文件：", coverFile); // 打印文件信息（如name、size）

            let imageUrl = '';
            if (coverFile) {
                console.log("开始上传文件：", coverFile.name);
                imageUrl = await uploadImageToIPFS(coverFile);
                console.log('图片上传成功，IPFS URL：', imageUrl);
            } else {
                console.log("未选择图片文件");
            }
            console.log(`市场投票结束时间:${voteEndTime}`);
            // 6. 调用链上创建市场方法
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
            toast.success(`创建成功！市场ID: ${marketId}`);
            navigate('/');
        } catch (err) {
            console.error('创建市场失败:', err);
            toast.dismiss(loadingToast);
            toast.error(`创建失败: ${err.message}`);
        }finally {
            // 4. 无论成功/失败，结束请求：设置 loading 为 false
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">创建预测市场</h1>
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                {/* 标题、分类、描述 保持不变 */}
                <div className="mb-4">
                    <label htmlFor="title" className="block text-sm font-medium mb-2">预测市场标题</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border"
                        placeholder="如：特斯拉Q3是否盈利？"
                        required
                        style={{color: "black"}}
                    />
                </div>

                <div className="mb-4">
                    <label htmlFor="category" className="block text-sm font-medium mb-2">预测分类</label>
                    <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                        style={{color: "black"}}
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
                    <label htmlFor="description" className="block text-sm font-medium mb-2">预测市场描述</label>
                    <textarea
                        id="description"
                        name="description"
                        rows="4"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="详细说明预测内容、规则等"
                        style={{color: "black"}}
                    />
                </div>

                {/* 封面上传（保持不变） */}
                <div className="mb-4">
                    <label htmlFor="cover" className="block text-sm font-medium mb-2">市场封面图片（可选）</label>
                    <input
                        type="file"
                        id="cover"
                        name="cover"
                        accept="image/*"
                        className="w-full px-3 py-2 border rounded-md"
                        style={{color: "black"}}
                    />
                </div>

                {/* 预测选项 + 赔率（新增赔率输入） */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">预测选项（至少2个）与赔率</label>
                    {formData.options.map((option, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(index, e.target.value)}
                                className="flex-1 px-3 py-2 border rounded-md"
                                placeholder={`选项 ${index + 1}`}
                                style={{color: "black"}}
                            />
                            <input
                                type="number"
                                value={formData.odds[index]}
                                onChange={(e) => handleOddsChange(index, e.target.value)}
                                className="w-24 px-3 py-2 border rounded-md"
                                placeholder="赔率（如 150=1.5x）"
                                min="1" // 赔率至少为 1
                                style={{color: "black"}}
                            />
                            {formData.options.length > 2 && (
                                <button
                                    type="button"
                                    onClick={() => removeOption(index)}
                                    className="px-2 py-2 border rounded-md text-red-500 hover:bg-red-50"
                                >
                                    删除
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addOption}
                        className="px-3 py-1 border rounded-md text-purple-600 hover:bg-purple-50"
                    >
                        + 添加选项
                    </button>
                </div>

                {/* 时间选择：新增结果公布时间 */}
                <div className="mb-4">
                    <label htmlFor="endTime" className="block text-sm font-medium mb-2">投票结束时间</label>
                    <input
                        type="datetime-local"
                        id="endTime"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                        style={{color: "black"}}
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="resultTime" className="block text-sm font-medium mb-2">结果公布时间</label>
                    <input
                        type="datetime-local"
                        id="resultTime"
                        name="resultTime"
                        value={formData.resultTime}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                        style={{color: "black"}}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        需晚于投票结束时间，用于公布最终结果
                    </p>
                </div>

                {/* 提交按钮 */}
                <button
                    type="submit"
                    // 禁用按钮：loading 为 true 时不可点击
                    disabled={loading}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-400"
                >
                    {/* 加载中显示“发布中...”，否则显示“发布预测市场” */}
                    {loading ? '发布中...' : '发布预测市场'}
                </button>
            </form>
        </div>
    );
};

export default CreateMarketPage;