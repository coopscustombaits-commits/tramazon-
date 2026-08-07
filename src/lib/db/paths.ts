/**
 * Every Firestore path the app uses, in one place. Screens and hooks should
 * never build path strings by hand — that's how a rename turns into a hunt.
 */
export const paths = {
  users: 'users',
  user: (uid: string) => `users/${uid}`,
  userPrivate: (uid: string) => `users/${uid}/private/profile`,
  userPushTokens: (uid: string) => `users/${uid}/pushTokens`,
  userPushToken: (uid: string, token: string) => `users/${uid}/pushTokens/${token}`,
  userNotifications: (uid: string) => `users/${uid}/notifications`,
  userWishlist: (uid: string) => `users/${uid}/wishlist`,
  userWishlistItem: (uid: string, productId: string) =>
    `users/${uid}/wishlist/${productId}`,
  userOrders: (uid: string) => `users/${uid}/orders`,
  userOrder: (uid: string, orderId: string) => `users/${uid}/orders/${orderId}`,

  usernames: 'usernames',
  username: (usernameLower: string) => `usernames/${usernameLower}`,

  admins: 'admins',
  admin: (uid: string) => `admins/${uid}`,

  announcements: 'announcements',
  announcement: (id: string) => `announcements/${id}`,

  posts: 'posts',
  post: (postId: string) => `posts/${postId}`,
  postLikes: (postId: string) => `posts/${postId}/likes`,
  postLike: (postId: string, uid: string) => `posts/${postId}/likes/${uid}`,
  postComments: (postId: string) => `posts/${postId}/comments`,
  postComment: (postId: string, commentId: string) =>
    `posts/${postId}/comments/${commentId}`,
} as const;

/** Cloud Storage object paths. */
export const storagePaths = {
  avatar: (uid: string, fileName: string) => `avatars/${uid}/${fileName}`,
  postMedia: (uid: string, fileName: string) => `posts/${uid}/${fileName}`,
} as const;
