package com.tracksecure.mqttrestapp.websocket;

import com.tracksecure.mqttrestapp.model.SensorData;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.tracksecure.mqttrestapp.service.MqttService;
import com.tracksecure.mqttrestapp.util.ApplicationContextProvider;

import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class SensorWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SensorWebSocketHandler.class);
    private final Set<WebSocketSession> sessions = new CopyOnWriteArraySet<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        log.info("WS: session established {}", session.getId());
        // Attempt to send the latest known sensor data immediately to the newly connected client.
        try {
            // Get MqttService lazily from application context to avoid circular injection
            MqttService mqttService = ApplicationContextProvider.getBean(MqttService.class);
            if (mqttService != null) {
                var latest = mqttService.getLatestData().get();
                if (latest != null) {
                    try {
                        String payload = objectMapper.writeValueAsString(latest);
                        session.sendMessage(new TextMessage(payload));
                        log.info("WS: sent initial latest data to session {} ({} bytes)", session.getId(), payload.length());
                    } catch (Exception e) {
                        log.warn("WS: failed to send initial latest data to {}: {}", session.getId(), e.getMessage(), e);
                    }
                }
            }
        } catch (Exception e) {
            // Non-fatal: if we can't fetch latest data, just continue
            log.debug("WS: could not send initial latest data to {}: {}", session.getId(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        log.info("WS: session closed {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // This server is push-only; optionally handle client messages here.
        log.debug("WS: received message from {}: {}", session.getId(), message.getPayload());
    }

    public void broadcastSensorData(SensorData data) {
        try {
            String payload = objectMapper.writeValueAsString(data);
            TextMessage msg = new TextMessage(payload);

            log.info("WS: broadcasting sensor data to {} sessions (payload {} bytes): {}", sessions.size(), payload.length(), payload);

            sessions.forEach(s -> {
                try {
                    if (s.isOpen()) {
                        log.debug("WS: sending to session {}", s.getId());
                        s.sendMessage(msg);
                    } else {
                        log.debug("WS: session {} is not open, skipping", s.getId());
                    }
                } catch (Exception e) {
                    log.warn("WS: failed to send message to {}: {}", s.getId(), e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            log.error("WS: failed to serialize SensorData for broadcast: {}", e.getMessage(), e);
        }
    }
}
