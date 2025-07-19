package com.example.clubotelandroidapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.border
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.clubotelandroidapp.ui.theme.ClubotelAndroidAppTheme
import androidx.compose.ui.graphics.Color

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ClubotelAndroidAppTheme {
                Surface(color = MaterialTheme.colors.background) {
                    PriceTableScreen()
                }
            }
        }
    }
}

@Composable
fun PriceTableScreen(viewModel: PriceTableViewModel = viewModel()) {
    var serverAddress by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(modifier = Modifier.padding(16.dp)) {
        Text("Enter server address (e.g. 192.168.1.100:8000):")
        BasicTextField(
            value = serverAddress,
            onValueChange = { serverAddress = it },
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp)
                .border(1.dp, MaterialTheme.colors.primary)
                .padding(8.dp),
            textStyle = LocalTextStyle.current.copy(color = Color.White)
        )
        Button(onClick = {
            isLoading = true
            error = null
            viewModel.fetchPrices(serverAddress, onError = {
                error = it
                isLoading = false
            }) {
                isLoading = false
            }
        }, enabled = !isLoading && serverAddress.isNotBlank()) {
            Text("Run")
        }
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.padding(16.dp))
        }
        error?.let {
            Text("Error: $it", color = MaterialTheme.colors.error)
        }
        PriceTable(viewModel.prices)
    }
}

@Composable
fun PriceTable(prices: List<PriceRow>) {
    if (prices.isEmpty()) return
    Column(modifier = Modifier.padding(top = 16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("In", modifier = Modifier.weight(1f))
            Text("Out", modifier = Modifier.weight(1f))
            Text("Room Only", modifier = Modifier.weight(1f))
            Text("Breakfast", modifier = Modifier.weight(1f))
        }
        Divider()
        prices.forEach { row ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(row.`in`, modifier = Modifier.weight(1f))
                Text(row.out, modifier = Modifier.weight(1f))
                Text(row.room_only?.toString() ?: "-", modifier = Modifier.weight(1f))
                Text(row.breakfast?.toString() ?: "-", modifier = Modifier.weight(1f))
            }
            Divider()
        }
    }
} 