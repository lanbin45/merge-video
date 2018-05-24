/**
 * @lib： 使用fluent-ffmpeg对指定目录下的视频合并
 * @依赖： node>6+
 * @使用: 
 *        1. npm install 安装依赖包
 *        2. node app.js [path]  通过命令行传path --> 方便php调用
 * @说明： 思路：
 *        1.遍历传进来的path下的所有文件，过滤出.mp4文件;
 *        2.在需合并目录下会维护一个已经合并过的文件mergedfiles.txt，避免重复合并;
 *          如果不存在该文件，则在合并完成之后，将当前目录下的文件名写进去；
 *          程序进来时会check这个文档找出已经合并过的视频，比较之后找出差集，使用fluent-ffmpeg合并，完成之后，在回调中更新mergedfiles.txt
 *        3.合并之后的文件保存在当前目录下的merged_video.mp4
 * @author： 兰兵
 * @Date: 2018.05.24
 * @Copyright: 广州谷东科技有限公司. All rights reserved.
 */

const path = require('path');
const fs = require('fs');

/*
 replicates this sequence of commands:
 ffmpeg -i title.mp4 -qscale:v 1 intermediate1.mpg
 ffmpeg -i source.mp4 -qscale:v 1 intermediate2.mpg
 ffmpeg -i concat:"intermediate1.mpg|intermediate2.mpg" -c copy intermediate_all.mpg
 ffmpeg -i intermediate_all.mpg -qscale:v 2 output.mp4
 Create temporary .mpg files for each video and deletes them after merge is completed.
 These files are created by filename pattern like [videoFilename.ext].temp.mpg [outputFilename.ext].temp.merged.mp4
 */
/**
 * ----------------------------------------------
 * fluent-ffmpeg配置
 * ----------------------------------------------
 */
var ffmpeg = require('fluent-ffmpeg');
var proc = ffmpeg();
var ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
var ffprobePath = require('@ffprobe-installer/ffprobe').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * ----------------------------------------------
 * 路径
 * ----------------------------------------------
 */
var Merge_Dir = process.argv[2]; // process.argv返回命令行的所有参数 [ '{{path-to-node}}/node', '{{path-to-app}}/app.js', '{{video-path}}']
if(!Merge_Dir){
  throw err;
}
var Absolute_Merge_Dir = path.resolve(Merge_Dir); // 解析为绝对路径
var Merged_File_Path = path.join(Absolute_Merge_Dir, 'mergedfiles.txt'); // 存放已合并文件信息
var OutPath = path.join(Absolute_Merge_Dir, 'merged_video.mp4'); // 合并后文件的存放位置
var TempPath = path.join(Absolute_Merge_Dir, 'temp.mp4'); // 临时文件，此处合并新添加文件时，需要将merged_video.mp4作为输入流读进来，
                                                          // 如果还使用merged_video.mp4作为输出流，则输入流中的相应文件将被清空合并完将被重命名为merged_video.mp4
var existFiles = travelDir(Absolute_Merge_Dir);
var existsMp4Files = filterMp4Files(existFiles)
checkMergedFiles(existsMp4Files)

/**
 * 文件遍历方法
 * @param dir 需要遍历的文件路径
 */
function travelDir(dir) {
  var results = []
  var list = fs.readdirSync(dir)
  list.forEach(function (file) {
    file = dir + '/' + file
    var stat = fs.statSync(file)
    if (stat && stat.isDirectory()) results = results.concat(travelDir(file))
    else results.push(file)
  })
  return results;
}

/**
 * 过滤出MP4文件
 * @param {Array} fileArr 包含当前目录下的所有文件名的数组
 * @returns {Array} fileArr中所有包含.mp4后缀的文件名数组
 */
function filterMp4Files(fileArr) {
  return fileArr.filter((val) => {
    return /.mp4/.test(val)
  })
}

/**
 * 将待合并文件传导ffmpeg中合并
 * @param {Array} toMergedFilesArr 包含过滤掉已合并文件之后的待合并视频文件名的数组
 */
function processFfmpeg(toMergedFilesArr) {
  // case:merged_video.mp4不会存到txt中，如果当前目录下存在merged_video.mp4，当文件不增加时，避免对merged_video.mp4合并
  if (toMergedFilesArr.length > 0 && (toMergedFilesArr.length == 1 && path.resolve(toMergedFilesArr[0]) !== path.resolve(OutPath))) {
    addVideoes2Proc(toMergedFilesArr)
  } else {
    console.log("no files to be merged!!")
  }
}

/**
 * 是否存在merged_video.mp4文件名
 * @param {Array} fileArr 文件名数组
 * @returns {Boolean} exists 如果当前数组中包含merged_video.mp4，为true,反之为false
 */
function isExistOutFile(fileArr) {
  let exists = false
  fileArr.every((val, index) => {
    if (path.resolve(val) == path.resolve(OutPath)) {
      exists = true
      return true
    }
    return true
  })
  return exists
}

/**
 * 过滤出merged_video.mp4文件
 * @param {Array} fileArr 文件名数组
 * @returns {Array} fileArr中所有非merged_video.mp4文件名数组
 */
function filterMergedFile(fileArr) {
  return fileArr.filter((val) => {
    return path.resolve(val) !== path.resolve(OutPath)
  })
}

/**
 * 检查已合并过的文件信息，如果存在mergedfiles.txt，则取出信息与当前录下文件取差集，得到待合并文件名数组；
 * 如果不存在，则新建mergedfiles.txt，并将当前目录下的文件名信息保存
 * @param {Array} fileArr 文件名数组
 */
function checkMergedFiles(fileArr) {
  fs.exists(Merged_File_Path, (exists) => {
    var toMergedFiles = [];
    if (exists) { // 存在mergedfiles.txt 
      fs.readFile(Merged_File_Path, 'utf-8', (err, buffer) => {
        if (err) throw err;
        let existsFileArr = buffer.split('\n'); // 按行读取文件名信息 
        var temp = [];
        existsFileArr.every((val, index) => {
          temp[val] = true;
          return true;
        })
        fileArr.every((val, index) => {
          if (!temp[val]) {
            toMergedFiles.push(val);
            return true;
          }
          return true
        }) // 取当前目录下文件与mergedfiles.txt中的文件名数组的差集
        processFfmpeg(toMergedFiles)
      })
    } else {
      let buffer = fileArr.join('\n'); // 按行存文件名信息
      fs.writeFile(Merged_File_Path, buffer, (err) => {
        if (err) throw err;
        console.log("Save merged file success!!");
        toMergedFiles = [...fileArr];
        processFfmpeg(toMergedFiles)
      })
    }
  })
}

/**
 * 将待合并文件读到ffmpeg的输入流中，merge到merged_video.mp4
 * @param {Array} fileArr 文件名数组 
 */
function addVideoes2Proc(fileArr) {
  var regRex = /.mp4/
  fileArr.every((fileName, index) => {
    if (regRex.test(fileName)) {
      proc = proc.addInput(path.resolve(fileName));
      return true
    }
    return true
  })

  proc
    .on('end', function () {
      console.log('files have been merged succesfully');
      // 更新已合并文件列表
      fs.writeFile(Merged_File_Path, filterMergedFile(existsMp4Files).join('\n'), (err) => {
        if (err) throw err;
        // 将临时文件重命名覆盖掉merged_video.mp4
        fs.rename(TempPath, OutPath, (err) => {
          console.log("Update merged files success!!")
        })
      })
    })
    .on('error', function (err) {
      console.log('an error happened: ' + err.message);
      // 出错之后直接关闭所有ffmpeg进程
      proc.kill('SIGSTOP')
    })
    .mergeToFile(TempPath);
}