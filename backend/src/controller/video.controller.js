import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { deleteFromCloudinary } from "../utils/deleteFromCloudinary.js";
import jwt from "jsonwebtoken";

//receive the public id from cloudinary to update or delete the previous file
function getPublicIdFromUrl(url) {
  const parts = url.split("/");
  const publicIdWithExtension = parts[parts.length - 1];
  const publicId = publicIdWithExtension.split(".")[0];
  return publicId;
}

const getAllVideos = asyncHandler(async (req, res) => {
  // const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
  const videos = await Video.find({}).populate({
    path: "uploader",
    select: "fullname username avatar",
  });
  // console.log("videos", videos);
  if (!videos) {
    return new ApiError(400, "Videos not fetched");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Video fetched successfully"));
});

// UPLOAD A VIDEO - TESTED

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  // TODO: get video, upload to cloudinary, create video
  if (!title || !description) {
    return new ApiError(400, "Please fill the require details");
  }

  const videoLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoLocalPath) {
    return new ApiError(400, "Video file is required");
  }
  if (!thumbnailLocalPath) {
    return new ApiError(400, "Thubmnail file is required");
  }

  const videoOnCloudinary = await uploadOnCloudinary(videoLocalPath);
  const ThubmnailOnCloudinary = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoOnCloudinary) {
    return new ApiError(400, "Video file is required");
  }

  if (!ThubmnailOnCloudinary) {
    return new ApiError(400, "Thubmnail file is required");
  }
  // console.log(videoOnCloudinary)

  const video = await Video.create({
    title,
    description,
    videoFile: videoOnCloudinary.url,
    thumbnail: ThubmnailOnCloudinary.url,
    duration: videoOnCloudinary.duration,
    uploader: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video uploaded successfully"));
});

// GET VIDEO BY VIDEO ID --TESTED
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  // console.log(videoId);
  if (!videoId) {
    new ApiError(404, "Id is not valid");
  }
  const video = await Video.findById(videoId).populate({
    path: "uploader",
    select: "fullname avatar username",
    options: { strictPopulate: false },
  });
  if (!video) {
    return res.status(404).json({ message: "Video not found" });
  }
  //INCREMENTING THE VIDEO COUN
  video.views += 1;
  await video.save();


  //to save the video in user's history, checking the user is logged in or not
  try {
    let user = null;
    const token =
      req.cookies?.accessToken ||
      req.headers?.authorization?.replace("Bearer ", "");

    if (token) {
      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken"
      );

      if (!user) {
        throw new ApiError(401, "Invalid Access Token");
      }
    }

    req.user = user;

    const loggedInUser = await User.findById(req.user._id);

    if (!loggedInUser) {
      throw new ApiError(404, "User not found");
    }

    loggedInUser.watchHistory.push(videoId);
    await loggedInUser.save();

    //  watch it - to get the like count or dislike count
    // const pipeline = [
    //   {
    //     $match: {
    //       video: videoId, // Replace videoId with the actual video ID
    //     },
    //   },
    //   {
    //     $project: {
    //       liked: {
    //         $cond: [
    //           { $in: [loggedInUser._id, "$like"] }, // Replace loggedUserId with the actual logged-in user ID
    //           true,
    //           false,
    //         ],
    //       },
    //       disliked: {
    //         $cond: [{ $in: [loggedInUser._id, "$dislike"] }, true, false],
    //       },
    //       likesCount: { $size: "$like" },
    //       dislikesCount: { $size: "$dislike" },
    //     },
    //   },
    // ];

    // const result = await Like.aggregate(pipeline);

    // console.log("result", result);

    // console.log(loggedInUser)
  } catch (error) {
    console.log("error while saving the history ", error);
  }

  await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        video,
        "Video fetched & incrementing the view count successfully"
      )
    );
});

// UPDATE A VIDEO BY OBJECT ID
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  //TODO: update video details like title, description, thumbnail
  if (!videoId) {
    throw new ApiError(404, "Id is not valid");
  }

  const updatedVideoData = { title, description };

  //destructuring the title and description to later add the thumbnail path

  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  //if thumbnail path receiving from client
  if (thumbnailLocalPath) {
    // Get the old video data
    const oldVideo = await Video.findById(videoId);
    // console.log("oldvideo", oldVideo);
    if (!oldVideo) {
      throw new ApiError(404, "Video not found");
    }

    const publicId = await getPublicIdFromUrl(oldVideo.thumbnail);
    await deleteFromCloudinary(publicId);
    //deleting the previous files before new file to save
    const ThubmnailOnCloudinary = await uploadOnCloudinary(thumbnailLocalPath);
    if (!ThubmnailOnCloudinary) {
      throw new ApiError(404, "thumbnail upload failed");
    }
    updatedVideoData.thumbnail = ThubmnailOnCloudinary.url;
  }
  console.log(title, description, thumbnailLocalPath);
  // console.log(videoId);
  const video = await Video.findByIdAndUpdate(videoId, updatedVideoData, {
    new: true,
  });

  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

//DELETE THE VIDEO BY VIDEO ID --TESTED
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // console.log(videoId);
  //TODO: delete video
  if (!videoId) {
    throw new ApiError(404, "Id is not valid");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video is not found");
  }
  const publicIdForThumbnail = await getPublicIdFromUrl(video.thumbnail);
  const publicIdForVideoFile = await getPublicIdFromUrl(video.thumbnail);
  await deleteFromCloudinary(publicIdForThumbnail);
  await deleteFromCloudinary(publicIdForVideoFile);

  await Video.findByIdAndDelete(videoId);
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

//PUBLISH STATUS
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
