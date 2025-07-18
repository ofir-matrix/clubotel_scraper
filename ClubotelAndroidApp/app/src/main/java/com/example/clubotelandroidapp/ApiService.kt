package com.example.clubotelandroidapp

import retrofit2.http.GET

interface ApiService {
    @GET("lowest_two_prices_json")
    suspend fun getPrices(): List<PriceRow>
} 