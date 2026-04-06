//
//  String.swift
//  AsMusic
//
//  Created by An So on 2026-04-06.
//




extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}
