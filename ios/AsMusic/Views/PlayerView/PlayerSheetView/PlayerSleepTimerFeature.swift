//
//  PlayerSleepTimerFeature.swift
//  AsMusic
//

import Observation
import SwiftUI

@Observable
@MainActor
final class PlayerSleepTimerManager {
  private(set) var activeMinutes: Int?
  private(set) var remainingSeconds: Int?

  @ObservationIgnored
  private var sleepTimerTask: Task<Void, Never>?

  deinit {
    sleepTimerTask?.cancel()
  }

  var countdownLabel: String? {
    guard let remainingSeconds, remainingSeconds > 0 else { return nil }
    let m = remainingSeconds / 60
    let s = remainingSeconds % 60
    return String(format: "%d:%02d", m, s)
  }

  func cancel() {
    sleepTimerTask?.cancel()
    sleepTimerTask = nil
    activeMinutes = nil
    remainingSeconds = nil
  }

  func start(minutes: Int, onElapsed: @escaping @MainActor () -> Void) {
    cancel()
    activeMinutes = minutes
    remainingSeconds = minutes * 60
    sleepTimerTask = Task { [weak self] in
      let endDate = Date().addingTimeInterval(Double(minutes * 60))
      while !Task.isCancelled {
        let remaining = max(0, Int(endDate.timeIntervalSinceNow.rounded(.up)))
        await MainActor.run {
          self?.remainingSeconds = remaining
        }
        if remaining <= 0 {
          break
        }
        do {
          try await Task.sleep(nanoseconds: 1_000_000_000)
        } catch {
          return
        }
      }
      await MainActor.run {
        onElapsed()
        self?.sleepTimerTask = nil
        self?.activeMinutes = nil
        self?.remainingSeconds = nil
      }
    }
  }
}

struct PlayerSleepTimerSheetView: View {
  @Binding var selectionMinutes: Double
  let hasActiveTimer: Bool
  let onCancel: () -> Void
  let onTurnOff: () -> Void
  let onStart: (Int) -> Void

  var body: some View {
    NavigationStack {
      VStack(spacing: 20) {
        Text("\(Int(selectionMinutes)) min")
          .font(.title3.monospacedDigit())

        Slider(
          value: $selectionMinutes,
          in: 1...120,
          step: 1
        )

        HStack {
          if hasActiveTimer {
            Button("Turn Off Timer", role: .destructive) {
              onTurnOff()
            }
          }
          Spacer()
          Button("Start") {
            onStart(Int(selectionMinutes))
          }
          .buttonStyle(.borderedProminent)
        }
      }
      .padding()
      .navigationTitle("Sleep Timer")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button("Cancel") { onCancel() }
        }
      }
    }
  }
}
