# merge-video
# 视频合并小工具
- lib： 

使用`fluent-ffmpeg`对指定目录下的视频合并
- 依赖：

node>6+
- 使用: 

     1. `npm install` 安装依赖包
     2. `node app.js [path]`  通过命令行传path --> 方便php调用
     
- 说明： 思路：
     1. 遍历传进来的path下的所有文件，过滤出.mp4文件;
     2. 在需合并目录下会维护一个已经合并过的文件`mergedfiles.txt`，避免重复合并;如果不存在该文件，则在合并完成之后，将当前目录下的文件名写进去；程序进来时会check这个文档找出已经合并过的视频，比较之后找出差集，使用`fluent-ffmpeg`合并，完成之后，在回调中更新`mergedfiles.txt`
     3. 合并之后的文件保存在当前目录下的`merged_video.mp4`
