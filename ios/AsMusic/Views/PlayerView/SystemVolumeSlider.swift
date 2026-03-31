//
//  SystemVolumeSlider.swift
//  AsMusic
//

import MediaPlayer
import SwiftUI
import UIKit

struct SystemVolumeSlider: UIViewRepresentable {
  func makeUIView(context: Context) -> MPVolumeView {
    let v = MPVolumeView(frame: .zero)
    configure(v)
    return v
  }

  func updateUIView(_ uiView: MPVolumeView, context: Context) {
    configure(uiView)
  }

  private func configure(_ volumeView: MPVolumeView) {
    hideRouteButton(in: volumeView)
    hideVolumeSliderThumb(in: volumeView)
  }

  private func hideRouteButton(in volumeView: MPVolumeView) {
    for subview in volumeView.subviews {
      guard let button = subview as? UIButton else { continue }
      let className = NSStringFromClass(type(of: button))
      if className.contains("RouteButton") {
        button.isHidden = true
        button.isUserInteractionEnabled = false
      }
    }
  }

  private func hideVolumeSliderThumb(in root: UIView) {
    if let slider = root as? UISlider {
      let clear = UIImage()
      slider.setThumbImage(clear, for: .normal)
      slider.setThumbImage(clear, for: .highlighted)
      slider.setThumbImage(clear, for: .selected)
      slider.setThumbImage(clear, for: .disabled)
    }
    for sub in root.subviews {
      hideVolumeSliderThumb(in: sub)
    }
  }
}
