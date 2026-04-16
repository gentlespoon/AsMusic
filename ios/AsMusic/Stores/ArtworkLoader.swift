//
//  ArtworkLoader.swift
//  AsMusic
//

import Foundation
import UIKit

private enum ArtworkURLSessionHolder {
  nonisolated(unsafe) static let session: URLSession = {
    let configuration = URLSessionConfiguration.default
    configuration.httpMaximumConnectionsPerHost = 8
    configuration.timeoutIntervalForRequest = 45
    configuration.requestCachePolicy = .returnCacheDataElseLoad
    return URLSession(configuration: configuration)
  }()
}

/// In-memory cached artwork loads (disk cache via `URLSession` URLCache when configured).
actor ArtworkLoader {
  static let shared = ArtworkLoader()

  private let memoryCache = NSCache<NSString, UIImage>()

  private init() {
    memoryCache.countLimit = 80
  }

  func uiImage(for url: URL) async -> UIImage? {
    let key = url.absoluteString as NSString
    if let cached = memoryCache.object(forKey: key) {
      return cached
    }
    do {
      let (data, _) = try await ArtworkURLSessionHolder.session.data(from: url)
      guard let image = UIImage(data: data) else { return nil }
      memoryCache.setObject(image, forKey: key)
      return image
    } catch {
      return nil
    }
  }
}
